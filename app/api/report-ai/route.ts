// GET /api/report-ai?reportId=xxx — SSE 字段级 AI 点评
// 先查 SQLite（report_id + as_of 唯一键）：命中则按字段顺序连推（回放，客户端打字机渲染），
// 未命中则三段串行生成（每段一个小 JSON，完成即推）+ 入库，下一次任何人打开直接回放。
// 事件：{type:'field',field,text} × N → {type:'done',model,generatedAt,cached}；异常 {type:'error'}
import { getXRay } from '@/lib/get-xray'
import { getReportAi, saveReportAi } from '@/lib/db/report-ai-db'
import { buildInsightMessages, parseInsight, type InsightSectionNotes } from '@/lib/llm/narrative'
import { chatOnce, llmAvailable } from '@/lib/llm/client'

export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()
const encodeEvent = (data: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

export async function GET(req: Request) {
  const reportId = new URL(req.url).searchParams.get('reportId')
  if (!reportId) {
    return Response.json({ error: 'reportId_required' }, { status: 400 })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encodeEvent(data))
      try {
        const xray = await getXRay(reportId)
        // fetchedAt 锚定到请求时刻，完整 ISO 时间戳会让缓存键每次都变、缓存永不命中；
        // 截断到「日」作缓存键——同日视为同一份数据快照，数据真正更新跨天后自然失效
        const cacheKey = xray.asOf.slice(0, 10)

        // 1) 缓存命中：直接回放（含 LLM 未配置但库里已有内容的历史生成）
        const cached = getReportAi(reportId, cacheKey)
        if (cached) {
          send({ type: 'field', field: 'summary', text: cached.summary })
          if (cached.lightReason) {
            send({ type: 'field', field: 'lightReason', text: cached.lightReason })
          }
          if (cached.sectionNotes && cached.sectionNotes !== '{}') {
            send({ type: 'field', field: 'sectionNotes', text: cached.sectionNotes })
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

        // summary 失败＝整场失败（主体缺失）；后两段失败降级为空，不拖垮整场
        // 不传 max_tokens：ling 系推理模型的思考链会吃掉小预算（finish_reason=length、content=null），
        // 沿用网关默认预算（与 /api/chat、nextSteps 生成一致）
        const summaryRaw = await chatOnce({ messages: buildInsightMessages(xray, 'summary') })
        const summary = parseInsight('summary', summaryRaw?.content ?? null, xray)
        if (typeof summary !== 'string') throw new Error('summary_failed')
        send({ type: 'field', field: 'summary', text: summary })

        const lightRaw = await chatOnce({ messages: buildInsightMessages(xray, 'lightReason') })
        const lightParsed = parseInsight('lightReason', lightRaw?.content ?? null, xray)
        const lightReason = typeof lightParsed === 'string' ? lightParsed : ''
        if (lightReason) send({ type: 'field', field: 'lightReason', text: lightReason })

        const notesRaw = await chatOnce({ messages: buildInsightMessages(xray, 'sectionNotes') })
        const notesParsed = parseInsight('sectionNotes', notesRaw?.content ?? null, xray)
        const sectionNotes: InsightSectionNotes =
          notesParsed && typeof notesParsed === 'object' ? notesParsed : {}
        if (Object.keys(sectionNotes).length) {
          send({ type: 'field', field: 'sectionNotes', text: JSON.stringify(sectionNotes) })
        }

        saveReportAi(reportId, cacheKey, {
          summary,
          lightReason,
          sectionNotes: JSON.stringify(sectionNotes),
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
