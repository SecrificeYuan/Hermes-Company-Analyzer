// GET /api/compare-ai?a=<id>&b=<id> — SSE 字段级 AI 深度对比
// 与 /api/report-ai 同一套机制：先查 SQLite（公司对 + 双方数据快照日），命中回放；
// 未命中三段串行生成（summary 失败＝整场失败，后两段失败降级为空）+ 入库。
// 事件：{type:'field',field,text} × N → {type:'done',model,generatedAt,cached}；异常 {type:'error'}
import { getXRay } from '@/lib/get-xray'
import { getCompareAi, saveCompareAi } from '@/lib/db/report-ai-db'
import { buildCompareMessages, parseCompareInsight, type CompareDimensionNotes } from '@/lib/llm/compare-narrative'
import { chatOnce, llmAvailable } from '@/lib/llm/client'

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
        // 与报告页同理：asOf 截断到「日」；公司对排序后拼接，A/B 互换命中同一份缓存
        const pairKey = [a.id, b.id].sort().join('|')
        const cacheKey = `${pairKey}|${a.asOf.slice(0, 10)}|${b.asOf.slice(0, 10)}`

        // 1) 缓存命中：直接回放
        const cached = forceRefresh ? null : getCompareAi(cacheKey)
        if (cached) {
          send({ type: 'field', field: 'summary', text: cached.summary })
          if (cached.verdict) {
            send({ type: 'field', field: 'verdict', text: cached.verdict })
          }
          if (cached.dimensionNotes && cached.dimensionNotes !== '{}') {
            send({ type: 'field', field: 'dimensionNotes', text: cached.dimensionNotes })
          }
          send({ type: 'done', model: cached.model, generatedAt: cached.generatedAt, cached: true })
          return
        }

        // 2) 未命中：实时生成（LLM 不可用时前端已探测拦截，这里兜底）
        if (!llmAvailable()) {
          send({ type: 'error', message: 'llm_not_configured' })
          return
        }
        const model = process.env.LLM_MODEL ?? 'unknown'
        const generatedAt = new Date().toISOString()

        // 不传 max_tokens：ling 系推理模型的思考链会吃掉小预算，沿用网关默认
        // timeoutMs 加大到 120s：双公司 payload 让推理链明显变长，30s 默认超时会被截断
        const LLM_TIMEOUT = 120_000
        const summaryRaw = await chatOnce({ messages: buildCompareMessages(a, b, 'summary'), timeoutMs: LLM_TIMEOUT })
        const summary = parseCompareInsight('summary', summaryRaw?.content ?? null, a, b)
        if (typeof summary !== 'string') throw new Error('summary_failed')
        send({ type: 'field', field: 'summary', text: summary })

        const verdictRaw = await chatOnce({ messages: buildCompareMessages(a, b, 'verdict'), timeoutMs: LLM_TIMEOUT })
        const verdictParsed = parseCompareInsight('verdict', verdictRaw?.content ?? null, a, b)
        const verdict = typeof verdictParsed === 'string' ? verdictParsed : ''
        if (verdict) send({ type: 'field', field: 'verdict', text: verdict })

        const notesRaw = await chatOnce({ messages: buildCompareMessages(a, b, 'dimensionNotes'), timeoutMs: LLM_TIMEOUT })
        const notesParsed = parseCompareInsight('dimensionNotes', notesRaw?.content ?? null, a, b)
        const dimensionNotes: CompareDimensionNotes =
          notesParsed && typeof notesParsed === 'object' ? notesParsed : {}
        if (Object.keys(dimensionNotes).length) {
          send({ type: 'field', field: 'dimensionNotes', text: JSON.stringify(dimensionNotes) })
        }

        saveCompareAi(cacheKey, {
          summary,
          verdict,
          dimensionNotes: JSON.stringify(dimensionNotes),
          model,
          generatedAt,
        })
        send({ type: 'done', model, generatedAt, cached: false })
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
