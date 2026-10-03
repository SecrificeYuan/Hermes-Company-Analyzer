// GET /api/signal-explain?reportId=xxx&signalId=yyy — 单信号 AI 解释（真流式 markdown）
// 按需生成：缓存键 report_id + signal_id + as_of(日) + model；命中回放整段。
// 事件：{type:'stream',field:'signal',delta} × N → {type:'done',...} / {type:'error',...}
import { getXRay } from '@/lib/get-xray'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { chatStream, llmAvailable, llmModelId } from '@/lib/llm/client'

export const dynamic = 'force-dynamic'

let db: DatabaseSync | null | undefined
function getDb(): DatabaseSync | null {
  if (db !== undefined) return db
  try {
    fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true })
    const instance = new DatabaseSync(path.join(process.cwd(), 'data', 'report-ai.db'))
    instance.exec(`
      CREATE TABLE IF NOT EXISTS signal_explain (
        report_id   TEXT NOT NULL,
        signal_id   TEXT NOT NULL,
        as_of       TEXT NOT NULL,
        model       TEXT NOT NULL,
        text        TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        PRIMARY KEY (report_id, signal_id, as_of, model)
      )
    `)
    db = instance
  } catch {
    db = null
  }
  return db
}

function getExpl(reportId: string, signalId: string, asOf: string, model: string): string | null {
  const d = getDb()
  if (!d) return null
  try {
    const row = d
      .prepare('SELECT text FROM signal_explain WHERE report_id = ? AND signal_id = ? AND as_of = ? AND model = ?')
      .get(reportId, signalId, asOf, model) as unknown
    if (!row || typeof row !== 'object') return null
    return String((row as Record<string, unknown>).text ?? '') || null
  } catch {
    return null
  }
}

function saveExpl(reportId: string, signalId: string, asOf: string, model: string, text: string): void {
  const d = getDb()
  if (!d) return
  try {
    d.prepare(`
      INSERT INTO signal_explain (report_id, signal_id, as_of, model, text, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (report_id, signal_id, as_of, model) DO UPDATE SET
        text = excluded.text, generated_at = excluded.generated_at
    `).run(reportId, signalId, asOf, model, text, new Date().toISOString())
  } catch {
    // 写失败仅损失缓存
  }
}

const encoder = new TextEncoder()
const encodeEvent = (data: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const reportId = params.get('reportId')
  const signalId = params.get('signalId')
  const forceRefresh = params.get('refresh') === '1'
  if (!reportId || !signalId) {
    return Response.json({ error: 'reportId_and_signalId_required' }, { status: 400 })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encodeEvent(data))
      try {
        const xray = await getXRay(reportId)
        const asOf = xray.asOf.slice(0, 10)
        const model = llmModelId('insight')

        if (!forceRefresh) {
          const cached = getExpl(reportId, signalId, asOf, model)
          if (cached) {
            send({ type: 'stream', field: 'signal', delta: cached, done: true })
            send({ type: 'done', model, generatedAt: new Date().toISOString(), cached: true })
            return
          }
        }

        if (!llmAvailable()) {
          send({ type: 'error', message: 'llm_not_configured' })
          return
        }

        const signal = xray.hiddenStatus.find((h) => h.id === signalId)
        if (!signal) {
          send({ type: 'error', message: 'signal_not_found' })
          return
        }

        const system = [
          '你是严谨的金融风险分析助手，给非专业读者把风险信号翻译成人话。',
          `用户场景是「付款前核对」。`,
          `请解释这个风险信号：「${signal.label}」。`,
          '直接输出 markdown 正文（不要代码围栏、不要 JSON 包裹），100~200 字：这是什么意思、为什么危险（或需要注意）、对付款决策意味着什么、建议怎么核实或应对。必须引用下方信号数据与证据，禁止泛泛而谈。',
          '铁律一：不得出现输入数据之外的任何数字，不确定就说「资料不足，无法确认」。',
          '铁律二：资料不足时明说，不得编造。',
          '铁律三：直接对读者说话，不得出现「模板」「命中信号」「输入数据」等内部词汇。',
        ].join('\n')

        const user = JSON.stringify({
          公司: xray.name,
          信号: signal.label,
          严重度: signal.severity,
          说明: signal.description,
          层数: signal.tier ? `${signal.tier.current}/${signal.tier.max}` : null,
          证据: signal.evidence.slice(0, 3).map((e) => `[${e.date}][${e.source}]${e.detail}`),
          数据基准日: xray.asOf,
        })

        let text = ''
        let ok = false
        try {
          for await (const ev of chatStream({
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            scene: 'insight',
            timeoutMs: 90_000,
          })) {
            if (ev.type === 'delta' && ev.text) {
              text += ev.text
              send({ type: 'stream', field: 'signal', delta: ev.text })
            }
          }
          ok = text.trim().length > 0
        } catch {
          ok = false
        }

        if (ok) {
          saveExpl(reportId, signalId, asOf, model, text)
          send({ type: 'done', model, generatedAt: new Date().toISOString(), cached: false })
        } else {
          send({ type: 'error', message: 'explain_failed' })
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'unknown_error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
