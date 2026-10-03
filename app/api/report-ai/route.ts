// GET /api/report-ai?reportId=xxx — SSE 字段级 AI 点评（重做版）
// 缓存：report_id + as_of(日) + model 三维键（换模型后同日不再回放旧模型内容）。
// 事件协议：
//   {type:'stream', field, delta}   — summary 真流式，逐 token 增量（PRO 长文 / LITE 短）
//   {type:'field', field, text}     — lightReason / sectionNotes 短 JSON 字段，完成即推
//   {type:'done', model, generatedAt, cached}
//   {type:'error', message}
// 生成策略：summary 流式（LLM 不可用/失败则不推，标记 summary_failed）；
// 短字段并行生成；任何一段失败仅该字段缺失，其余照常。
import { getXRay } from '@/lib/get-xray'
import { getReportAi, saveReportAi } from '@/lib/db/report-ai-db'
import { buildInsightMessages, parseInsight, buildSectionNotesMessages, parseSectionNotes, type InsightSectionNotes } from '@/lib/llm/narrative'
import { chatOnce, chatStream, llmAvailable, llmModelId } from '@/lib/llm/client'

export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()
const encodeEvent = (data: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

export async function GET(req: Request) {
  const reportId = new URL(req.url).searchParams.get('reportId')
  const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1'
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
        const cacheKey = `${xray.asOf.slice(0, 10)}|${llmModelId('insight')}`

        // 1) 缓存命中：直接回放（refresh=1 为重试/重新生成，跳过缓存并覆盖落库）
        const cached = forceRefresh ? null : getReportAi(reportId, cacheKey)
        if (cached) {
          // summary 走一次性整段推（缓存回放无流式意义）
          if (cached.summary) send({ type: 'stream', field: 'summary', delta: cached.summary, done: true })
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
        const model = llmModelId('insight')
        const generatedAt = new Date().toISOString()
        const LLM_TIMEOUT = 90_000

        // summary：真流式 markdown 输出，边收边推（不经 JSON 守卫——流式无法事后 JSON 校验，
        // 全数字溯源守卫在流完后做，失败则整段丢弃并标 summary_failed 让前端出重试）
        let summaryText = ''
        let summaryOk = false
        try {
          for await (const ev of chatStream({
            messages: buildInsightMessages(xray, 'summary'),
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

        // 短字段并行：lightReason + sectionNotes 互不依赖
        const [lightRaw, notesRaw] = await Promise.all([
          chatOnce({ messages: buildInsightMessages(xray, 'lightReason'), scene: 'insight', timeoutMs: LLM_TIMEOUT }),
          chatOnce({ messages: buildSectionNotesMessages(xray), scene: 'insight', timeoutMs: LLM_TIMEOUT }),
        ])

        const lightReason = (() => {
          const parsed = parseInsight('lightReason', lightRaw?.content ?? null, xray)
          return typeof parsed === 'string' ? parsed : ''
        })()
        if (lightReason) send({ type: 'field', field: 'lightReason', text: lightReason })

        const sectionNotes: InsightSectionNotes = (() => {
          const parsed = parseSectionNotes(notesRaw?.content ?? null, xray)
          return parsed && typeof parsed === 'object' ? parsed : {}
        })()
        if (Object.keys(sectionNotes).length) {
          send({ type: 'field', field: 'sectionNotes', text: JSON.stringify(sectionNotes) })
        }

        // summary 失败仍落库短字段，但前端要知道 summary 挂了（hasSummary=false）
        saveReportAi(reportId, cacheKey, {
          summary: summaryOk ? summaryText : '',
          lightReason,
          sectionNotes: JSON.stringify(sectionNotes),
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
