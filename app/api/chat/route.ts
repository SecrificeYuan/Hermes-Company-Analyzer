// POST /api/chat — SSE 流式对话路由
// 503（未配置）→ 检查在 JSON 解析之前；400（messages 空/非数组/JSON 非法）
// 200 → ReadableStream，事件序列 runAgent 产出 + 末尾 done（或异常时 error 事件）
// 事件编码：data: {json}\n\n；Content-Type: text/event-stream; charset=utf-8；Cache-Control: no-cache；force-dynamic
import { runAgent } from '@/lib/chat/agent'
import { llmAvailable, type ChatMessage } from '@/lib/llm/client'

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encodeEvent(data))
      try {
        await runAgent(messages as ChatMessage[], send)
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
