// POST /api/chat — SSE 流式对话路由
// 503（未配置）→ 检查在 JSON 解析之前；400（messages 空/非数组/JSON 非法）
// 200 → ReadableStream，事件序列 runAgent 产出 + 末尾 done（或异常时 error 事件）
// 事件编码：data: {json}\n\n；Content-Type: text/event-stream; charset=utf-8；Cache-Control: no-cache；force-dynamic
// reportId（可选）：报告页「追问 AI」注入该报告全量事实快照作为系统上下文
import { runAgent } from '@/lib/chat/agent'
import { llmAvailable, type ChatMessage } from '@/lib/llm/client'
import { getXRay } from '@/lib/get-xray'
import { buildFactPayload, buildSignalPayload } from '@/lib/llm/facts'

export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()

function encodeEvent(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(req: Request) {
  if (!llmAvailable()) {
    return Response.json({ available: false }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const messages = (body as { messages?: unknown })?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages_required' }, { status: 400 })
  }

  // 可选：注入报告上下文（报告页「追问 AI」入口）
  const reportId = (body as { reportId?: unknown })?.reportId
  let reportContext: ChatMessage | null = null
  if (typeof reportId === 'string' && reportId.trim()) {
    try {
      const xray = await getXRay(reportId.trim())
      reportContext = {
        role: 'system',
        content: [
          `以下是用户刚查看的「${xray.name}」X 光报告全量事实快照（基准日 ${xray.asOf}）。`,
          `灯色：${xray.overallRisk === 'green' ? '绿灯' : xray.overallRisk === 'yellow' ? '黄灯' : '红灯'}，风险评分 ${xray.riskScore}/100。`,
          `结论：${xray.verdict}`,
          `五维事实：${JSON.stringify(buildFactPayload(xray))}`,
          `命中信号：${JSON.stringify(buildSignalPayload(xray))}`,
          '用户的问题是基于这份报告追问，请结合上述事实回答；不要重复整份报告，聚焦用户追问的点。',
        ].join('\n'),
      }
    } catch {
      // 报告取数失败：静默降级为普通对话
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encodeEvent(data))
      try {
        await runAgent(messages as ChatMessage[], send, reportContext ? [reportContext] : undefined)
        send({ type: 'done' })
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
