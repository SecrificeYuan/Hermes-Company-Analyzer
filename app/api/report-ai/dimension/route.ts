// GET /api/report-ai/dimension?reportId=xxx&dim=hp — PRO 单维度深读（真流式 markdown）
// 按需生成：键 report_id + dim + as_of(日) + model；缓存命中回放整段。
// 事件：{type:'stream',field:'dim',delta} × N → {type:'done',...} / {type:'error',...}
import { getXRay } from '@/lib/get-xray'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { buildFactPayload, buildSignalPayload } from '@/lib/llm/facts'
import { chatStream, llmAvailable, llmModelId } from '@/lib/llm/client'
import type { NarrativeKey } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DIM_TITLES: Record<NarrativeKey, string> = {
  hp: '财务健康', def: '股权质押', atk: '涉诉', morale: '舆情', network: '关联网络',
}

// ── 轻量独立缓存（report_ai_dimension 表，与 report_ai 库共存） ──
let db: DatabaseSync | null | undefined
function getDb(): DatabaseSync | null {
  if (db !== undefined) return db
  try {
    fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true })
    const instance = new DatabaseSync(path.join(process.cwd(), 'data', 'report-ai.db'))
    instance.exec(`
      CREATE TABLE IF NOT EXISTS report_ai_dimension (
        report_id   TEXT NOT NULL,
        dim         TEXT NOT NULL,
        as_of       TEXT NOT NULL,
        model       TEXT NOT NULL,
        text        TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        PRIMARY KEY (report_id, dim, as_of, model)
      )
    `)
    db = instance
  } catch {
    db = null
  }
  return db
}

function getDim(reportId: string, dim: NarrativeKey, asOf: string, model: string): string | null {
  const d = getDb()
  if (!d) return null
  try {
    const row = d
      .prepare('SELECT text FROM report_ai_dimension WHERE report_id = ? AND dim = ? AND as_of = ? AND model = ?')
      .get(reportId, dim, asOf, model) as unknown
    if (!row || typeof row !== 'object') return null
    return String((row as Record<string, unknown>).text ?? '') || null
  } catch {
    return null
  }
}

function saveDim(reportId: string, dim: NarrativeKey, asOf: string, model: string, text: string): void {
  const d = getDb()
  if (!d) return
  try {
    d.prepare(`
      INSERT INTO report_ai_dimension (report_id, dim, as_of, model, text, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (report_id, dim, as_of, model) DO UPDATE SET
        text = excluded.text, generated_at = excluded.generated_at
    `).run(reportId, dim, asOf, model, text, new Date().toISOString())
  } catch {
    // 写失败仅损失缓存
  }
}

const encoder = new TextEncoder()
const encodeEvent = (data: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const reportId = params.get('reportId')
  const dim = params.get('dim') as NarrativeKey | null
  const forceRefresh = params.get('refresh') === '1'
  if (!reportId || !dim || !(dim in DIM_TITLES)) {
    return Response.json({ error: 'reportId_and_valid_dim_required' }, { status: 400 })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encodeEvent(data))
      try {
        const xray = await getXRay(reportId)
        const asOf = xray.asOf.slice(0, 10)
        const model = llmModelId('insight')
        const cacheKeyAsOf = asOf

        if (!forceRefresh) {
          const cached = getDim(reportId, dim, cacheKeyAsOf, model)
          if (cached) {
            send({ type: 'stream', field: dim, delta: cached, done: true })
            send({ type: 'done', model, generatedAt: new Date().toISOString(), cached: true })
            return
          }
        }

        if (!llmAvailable()) {
          send({ type: 'error', message: 'llm_not_configured' })
          return
        }

        const facts = buildFactPayload(xray)
        const system = [
          '你是严谨的金融风险分析助手，给非专业读者写人话深度解读。',
          `用户场景是「付款前核对」，当前灯色为${xray.overallRisk === 'green' ? '绿灯' : xray.overallRisk === 'yellow' ? '黄灯' : '红灯'}。`,
          `请只围绕「${DIM_TITLES[dim]}」这一维度写深度解读。`,
          '直接输出 markdown 正文（不要代码围栏、不要 JSON 包裹），250~400 字：这个维度在说什么、数据反映了什么、对付款决策意味着什么、要注意什么。必须引用下方该维度的具体数据，禁止泛泛而谈。',
          '铁律一：不得出现输入数据之外的任何数字，不确定就说「资料不足，无法确认」。',
          '铁律二：资料不足时明说，不得编造。',
          '铁律三：直接对读者说话，不得出现「模板」「命中信号」「输入数据」等内部词汇。',
        ].join('\n')

        const user = JSON.stringify({
          公司: xray.name,
          维度: DIM_TITLES[dim],
          该维度事实: facts[dim],
          命中信号: buildSignalPayload(xray),
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
              send({ type: 'stream', field: dim, delta: ev.text })
            }
          }
          ok = text.trim().length > 0
        } catch {
          ok = false
        }

        if (ok) {
          saveDim(reportId, dim, cacheKeyAsOf, model, text)
          send({ type: 'done', model, generatedAt: new Date().toISOString(), cached: false })
        } else {
          send({ type: 'error', message: 'dimension_failed' })
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
