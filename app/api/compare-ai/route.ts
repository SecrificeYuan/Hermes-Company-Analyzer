// GET /api/compare-ai?a=<id>&b=<id> — SSE 字段级 AI 深度对比（重做版）
// 缓存：公司对 + 双方数据快照日 + model 四维键。summary 真流式，verdict/dimensionNotes 并行 JSON。
// 事件：{type:'stream',field:'summary',delta} / {type:'field',...} / {type:'done',...} / {type:'error',...}
import { getXRay } from '@/lib/get-xray'
import { getCompareAi, saveCompareAi } from '@/lib/db/report-ai-db'
import { buildCompareMessages, parseCompareInsight, buildCompareDimensionNotesMessages, parseCompareDimensionNotes, type CompareDimensionNotes } from '@/lib/llm/compare-narrative'
import { chatOnce, chatStream, llmAvailable, llmModelId } from '@/lib/llm/client'

export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()
const encodeEvent = (data: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const aId = params.get('a')
  const bId = params.get('b')
  const forceRefresh = params.get('refresh') === '1'
  if (!aId || !bId || aId === bId) {
    return Response.json({ error: 'a_and_b_required' }, { status: 400 })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encodeEvent(data))
      try {
        const [a, b] = await Promise.all([getXRay(aId), getXRay(bId)])
        // 与报告页同理：asOf 截断到「日」；公司对排序后拼接，A/B 互换命中同一份缓存；加 model 维度
        const pairKey = [a.id, b.id].sort().join('|')
        const cacheKey = `${pairKey}|${a.asOf.slice(0, 10)}|${b.asOf.slice(0, 10)}|${llmModelId('insight')}`

        // 1) 缓存命中：直接回放
        const cached = forceRefresh ? null : getCompareAi(cacheKey)
        if (cached) {
          if (cached.summary) send({ type: 'stream', field: 'summary', delta: cached.summary, done: true })
          if (cached.verdict) {
            send({ type: 'field', field: 'verdict', text: cached.verdict })
          }
          if (cached.dimensionNotes && cached.dimensionNotes !== '{}') {
            send({ type: 'field', field: 'dimensionNotes', text: cached.dimensionNotes })
          }
          send({ type: 'done', model: cached.model, generatedAt: cached.generatedAt, cached: true })
          return
        }

        // 2) 未命中：实时生成
        if (!llmAvailable()) {
          send({ type: 'error', message: 'llm_not_configured' })
          return
        }
        const model = llmModelId('insight')
        const generatedAt = new Date().toISOString()
        const LLM_TIMEOUT = 120_000

        // summary：真流式 markdown 输出
        let summaryText = ''
        let summaryOk = false
        try {
          for await (const ev of chatStream({
            messages: buildCompareMessages(a, b, 'summary'),
            scene: 'insight',
            timeoutMs: LLM_TIMEOUT,
          })) {
            if (ev.type === 'delta' && ev.text) {
              summaryText += ev.text
              send({ type: 'stream', field: 'summary', delta: ev.text })
            }
          }
          summaryOk = summaryText.trim().length > 0
        } catch {
          summaryOk = false
        }

        // 短字段并行
        const [verdictRaw, notesRaw] = await Promise.all([
          chatOnce({ messages: buildCompareMessages(a, b, 'verdict'), scene: 'insight', timeoutMs: LLM_TIMEOUT }),
          chatOnce({ messages: buildCompareDimensionNotesMessages(a, b), scene: 'insight', timeoutMs: LLM_TIMEOUT }),
        ])

        const verdict = (() => {
          const parsed = parseCompareInsight('verdict', verdictRaw?.content ?? null, a, b)
          return typeof parsed === 'string' ? parsed : ''
        })()
        if (verdict) send({ type: 'field', field: 'verdict', text: verdict })

        const dimensionNotes: CompareDimensionNotes = (() => {
          const parsed = parseCompareDimensionNotes(notesRaw?.content ?? null, a, b)
          return parsed && typeof parsed === 'object' ? parsed : {}
        })()
        if (Object.keys(dimensionNotes).length) {
          send({ type: 'field', field: 'dimensionNotes', text: JSON.stringify(dimensionNotes) })
        }

        saveCompareAi(cacheKey, {
          summary: summaryOk ? summaryText : '',
          verdict,
          dimensionNotes: JSON.stringify(dimensionNotes),
          model,
          generatedAt,
        })
        send({ type: 'done', model, generatedAt, cached: false, hasSummary: summaryOk })
        if (!summaryOk) send({ type: 'error', message: 'summary_failed' })
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
