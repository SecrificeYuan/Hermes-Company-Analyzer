export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | null
}

export interface ChatThread {
  id: string
  title: string
  at: number
  messages: ChatMessage[]
}

const STORAGE_KEY = 'hermes-chat-threads'
const MAX_THREADS = 3

function isMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (m.role === 'user' || m.role === 'assistant' || m.role === 'tool') &&
    (typeof m.content === 'string' || m.content === null)
}

function isThread(value: unknown): value is ChatThread {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return typeof t.id === 'string' && typeof t.title === 'string' &&
    typeof t.at === 'number' && Array.isArray(t.messages) && t.messages.every(isMessage)
}

/** 读取最近对话（新→旧）；SSR 或数据损坏时返回空数组 */
export function getChatThreads(): ChatThread[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isThread).slice(0, MAX_THREADS)
  } catch {
    return []
  }
}

/** 新增/覆盖一条对话：按 id 去重、置顶、最多保留 3 条；返回更新后的列表 */
export function addChatThread(thread: ChatThread): ChatThread[] {
  const rest = getChatThreads().filter((t) => t.id !== thread.id)
  const next = [thread, ...rest]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_THREADS)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 隐私模式等写入失败：仅内存返回，不抛错
    }
  }
  return next
}

/** 删除一条对话；返回更新后的列表 */
export function deleteChatThread(id: string): ChatThread[] {
  const next = getChatThreads().filter((t) => t.id !== id)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 写入失败静默降级
    }
  }
  return next
}
