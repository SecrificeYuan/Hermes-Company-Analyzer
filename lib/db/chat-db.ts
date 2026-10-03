// 会话持久化的服务端存储（Node 内置 node:sqlite，零原生依赖）。
// 无登录系统：客户端持有匿名 client_id（localStorage UUID），服务端按 (client_id, chat_id) 隔离。
// 写入语义为整会话覆盖（与前端 persistMsgs 一致），db 不可写时整体降级为无服务端存储。
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export interface StoredChat {
  chatId: string
  title: string
  updatedAt: number
  messagesJson: string
}

let db: DatabaseSync | null | undefined // undefined=未初始化 null=不可用

function openDbAt(file: string): DatabaseSync | null {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const instance = new DatabaseSync(file)
    instance.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        client_id    TEXT NOT NULL,
        chat_id      TEXT NOT NULL,
        title        TEXT NOT NULL,
        updated_at   INTEGER NOT NULL,
        messages_json TEXT NOT NULL,
        PRIMARY KEY (client_id, chat_id)
      )
    `)
    return instance
  } catch {
    return null
  }
}

function getDb(): DatabaseSync | null {
  if (db !== undefined) return db
  db = openDbAt(path.join(process.cwd(), 'data', 'chat.db'))
  return db
}

function rowToChat(r: Record<string, unknown>): StoredChat {
  return {
    chatId: String(r.chat_id ?? ''),
    title: String(r.title ?? ''),
    updatedAt: Number(r.updated_at ?? 0),
    messagesJson: String(r.messages_json ?? '[]'),
  }
}

/** 列出某客户端的会话（新→旧，最多 limit 条） */
export function listChats(clientId: string, limit = 50): StoredChat[] {
  const d = getDb()
  if (!d) return []
  try {
    const rows = d
      .prepare('SELECT chat_id, title, updated_at, messages_json FROM chats WHERE client_id = ? ORDER BY updated_at DESC LIMIT ?')
      .all(clientId, limit) as unknown
    if (!Array.isArray(rows)) return []
    return rows.map((r) => rowToChat(r as Record<string, unknown>))
  } catch {
    return []
  }
}

export function getChat(clientId: string, chatId: string): StoredChat | null {
  const d = getDb()
  if (!d) return null
  try {
    const row = d
      .prepare('SELECT chat_id, title, updated_at, messages_json FROM chats WHERE client_id = ? AND chat_id = ?')
      .get(clientId, chatId) as unknown
    if (!row || typeof row !== 'object') return null
    return rowToChat(row as Record<string, unknown>)
  } catch {
    return null
  }
}

/** 整会话覆盖写；updated_at 更大才覆盖，避免乱序的旧请求盖掉新状态 */
export function saveChat(clientId: string, chat: StoredChat): void {
  const d = getDb()
  if (!d) return
  try {
    d.prepare(`
      INSERT INTO chats (client_id, chat_id, title, updated_at, messages_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (client_id, chat_id) DO UPDATE SET
        title = excluded.title,
        updated_at = excluded.updated_at,
        messages_json = excluded.messages_json
      WHERE excluded.updated_at >= chats.updated_at
    `).run(clientId, chat.chatId, chat.title, chat.updatedAt, chat.messagesJson)
  } catch {
    // 写入失败静默降级（与 report-ai 缓存同一策略）
  }
}

export function deleteChat(clientId: string, chatId: string): void {
  const d = getDb()
  if (!d) return
  try {
    d.prepare('DELETE FROM chats WHERE client_id = ? AND chat_id = ?').run(clientId, chatId)
  } catch {
    // 静默降级
  }
}
