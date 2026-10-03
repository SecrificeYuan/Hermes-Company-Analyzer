export interface ChatAttachment {
  /** report=报告页带过来的 X 光快照；company=聊天中搜索添加的公司主体 */
  type: 'report' | 'company'
  /** reportId 或公司主体 id（股票代码/工商 id） */
  id: string
  /** 附件显示名（公司名） */
  name: string
  addedAt: number
}

export interface ChatMessage {
  /** tool=工具进度行（content=label）；card=报告卡（content=卡片 JSON 字符串）——均不落 LLM，仅本地留痕 */
  role: 'user' | 'assistant' | 'tool' | 'card'
  content: string | null
  /** tool 行的工具名，供前端图标映射 */
  name?: string
  /** 用户消息附带的"附件"：报告快照 / 搜索添加的公司主体；服务端展开为系统上下文注入（AI 无需再调工具拉取） */
  attachments?: ChatAttachment[]
}

export interface ChatThread {
  id: string
  title: string
  at: number
  messages: ChatMessage[]
}

const STORAGE_KEY = 'hermes-chat-threads'
const CLIENT_ID_KEY = 'hermes-client-id'
const MAX_THREADS = 50

/**
 * 匿名客户端 ID（方案 A 的唯一凭证）：首次生成 UUID 存 localStorage，此后所有请求携带。
 * 清浏览器数据后旧会话在服务端仍在，但无法找回——与产品决策一致。
 */
export function getClientId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY)
    if (existing) return existing
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(CLIENT_ID_KEY, id)
    return id
  } catch {
    return ''
  }
}

/** 整会话推送到服务端（fire-and-forget，失败静默；页面卸载时靠 keepalive 兜底） */
function pushToServer(thread: ChatThread): void {
  const clientId = getClientId()
  if (!clientId || typeof window === 'undefined') return
  try {
    void fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, thread }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // 静默降级：只剩 localStorage
  }
}

function removeFromServer(id: string): void {
  const clientId = getClientId()
  if (!clientId || typeof window === 'undefined') return
  try {
    void fetch(`/api/chats?clientId=${encodeURIComponent(clientId)}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      keepalive: true,
    }).catch(() => {})
  } catch {
    // 静默降级
  }
}

function isMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (m.role === 'user' || m.role === 'assistant' || m.role === 'tool' || m.role === 'card') &&
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
  pushToServer(thread)
  return next
}

/** 删除一条对话（本地 + 服务端）；返回更新后的列表 */
export function deleteChatThread(id: string): ChatThread[] {
  const next = getChatThreads().filter((t) => t.id !== id)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 写入失败静默降级
    }
  }
  removeFromServer(id)
  return next
}

/**
 * 启动时用服务端会话回填/合并本地列表：同 id 取 updated_at 较大者，
 * 本地较新或服务端缺失的会话顺手回推。网络失败或无服务端存储时原样返回本地列表。
 */
export async function hydrateChatThreads(): Promise<ChatThread[]> {
  const local = getChatThreads()
  const clientId = getClientId()
  if (!clientId) return local
  try {
    const res = await fetch(`/api/chats?clientId=${encodeURIComponent(clientId)}`)
    if (!res.ok) return local
    const data: unknown = await res.json()
    const server: ChatThread[] = Array.isArray((data as { threads?: unknown })?.threads)
      ? ((data as { threads: unknown[] }).threads as unknown[]).filter(isThread)
      : []

    const merged = new Map<string, ChatThread>()
    for (const t of local) merged.set(t.id, t)
    for (const t of server) {
      const l = merged.get(t.id)
      if (!l || l.at < t.at) merged.set(t.id, t)
    }
    const next = [...merged.values()].sort((a, b) => b.at - a.at).slice(0, MAX_THREADS)

    // 本地有但服务端没有、或本地更新的，回推补全服务端
    for (const t of next) {
      const s = server.find((x) => x.id === t.id)
      if (!s || s.at < t.at) pushToServer(t)
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 静默降级
    }
    return next
  } catch {
    return local
  }
}
