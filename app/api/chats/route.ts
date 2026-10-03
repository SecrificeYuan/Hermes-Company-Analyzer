// 会话持久化 API（方案 A：匿名 client_id + 服务端 sqlite）。
// GET    /api/chats?clientId=xxx          → { threads: ChatThread[] }
// POST   /api/chats  { clientId, thread } → 整会话覆盖 upsert
// DELETE /api/chats?clientId=&id=         → 删除
// client_id 是无登录体系下的唯一凭证：UUID 即权限，服务端只校验格式不校验归属。
import { listChats, saveChat, deleteChat } from '@/lib/db/chat-db'

export const dynamic = 'force-dynamic'

const CLIENT_ID_RE = /^[\w-]{8,64}$/

function validClientId(v: unknown): v is string {
  return typeof v === 'string' && CLIENT_ID_RE.test(v)
}

interface IncomingMessage {
  role: 'user' | 'assistant' | 'tool' | 'card'
  content: string | null
}

interface IncomingThread {
  id: string
  title: string
  at: number
  messages: IncomingMessage[]
}

function isMessage(value: unknown): value is IncomingMessage {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (m.role === 'user' || m.role === 'assistant' || m.role === 'tool' || m.role === 'card') &&
    (typeof m.content === 'string' || m.content === null)
}

function isThread(value: unknown): value is IncomingThread {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return typeof t.id === 'string' && t.id.length <= 64 &&
    typeof t.title === 'string' && t.title.length <= 200 &&
    typeof t.at === 'number' && Number.isFinite(t.at) &&
    Array.isArray(t.messages) && t.messages.every(isMessage)
}

export async function GET(req: Request) {
  const clientId = new URL(req.url).searchParams.get('clientId')
  if (!validClientId(clientId)) {
    return Response.json({ error: 'invalid_client_id' }, { status: 400 })
  }
  const threads = listChats(clientId).flatMap((c) => {
    try {
      return [{ id: c.chatId, title: c.title, at: c.updatedAt, messages: JSON.parse(c.messagesJson) as IncomingMessage[] }]
    } catch {
      return []
    }
  })
  return Response.json({ threads })
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }
  const { clientId, thread } = (body ?? {}) as { clientId?: unknown; thread?: unknown }
  if (!validClientId(clientId)) {
    return Response.json({ error: 'invalid_client_id' }, { status: 400 })
  }
  if (!isThread(thread)) {
    return Response.json({ error: 'invalid_thread' }, { status: 400 })
  }
  saveChat(clientId, {
    chatId: thread.id,
    title: thread.title,
    updatedAt: thread.at,
    messagesJson: JSON.stringify(thread.messages),
  })
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const clientId = url.searchParams.get('clientId')
  const chatId = url.searchParams.get('id')
  if (!validClientId(clientId) || typeof chatId !== 'string' || chatId.length > 64) {
    return Response.json({ error: 'invalid_params' }, { status: 400 })
  }
  deleteChat(clientId, chatId)
  return Response.json({ ok: true })
}
