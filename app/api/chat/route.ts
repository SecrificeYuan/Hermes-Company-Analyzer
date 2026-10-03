// POST /api/chat — SSE 流式对话路由
// 503（未配置）→ 检查在 JSON 解析之前；400（messages 空/非数组/JSON 非法）
// 200 → ReadableStream，事件序列 runAgent 产出 + 末尾 done（或异常时 error 事件）
// 事件编码：data: {json}\n\n；Content-Type: text/event-stream; charset=utf-8；Cache-Control: no-cache；force-dynamic
// body.attachments（可选）：用户附加的报告/公司快照，展开为系统上下文注入（AI 无需再调工具拉取）
// body.reportId（可选，兼容旧入口）：等价于 attachments=[{type:'report',id:reportId}]
import { runAgent } from '@/lib/chat/agent'
import { llmAvailable, type ChatMessage } from '@/lib/llm/client'
import { expandAttachments, type RawAttachment } from '@/lib/chat/attachment-context'

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

  // 附件收集：body.attachments + 兼容旧 reportId 参数
  const raw: RawAttachment[] = []
  const reportId = (body as { reportId?: unknown })?.reportId
  if (typeof reportId === 'string' && reportId.trim()) {
    raw.push({ type: 'report', id: reportId.trim() })
  }
  const bodyAttachments = (body as { attachments?: unknown })?.attachments
  if (Array.isArray(bodyAttachments)) {
    for (const a of bodyAttachments) {
      const att = a as RawAttachment
      if (att && typeof att === 'object' && typeof att.id === 'string') {
        raw.push({ type: att.type === 'company' ? 'company' : 'report', id: att.id, name: typeof att.name === 'string' ? att.name : undefined })
      }
    }
  }

  let attachmentContext: ChatMessage | null = null
  if (raw.length) {
    try {
      const text = await expandAttachments(raw)
      if (text) attachmentContext = { role: 'system', content: text }
    } catch {
      // 附件展开失败：静默降级为普通对话（AI 仍可走工具路径）
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encodeEvent(data))
      try {
        await runAgent(messages as ChatMessage[], send, attachmentContext ? [attachmentContext] : undefined)
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
