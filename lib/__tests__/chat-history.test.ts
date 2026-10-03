import { describe, it, expect, beforeEach } from 'vitest'
import { getChatThreads, addChatThread, type ChatThread } from '@/lib/chat-history'

function thread(id: string, at = 0): ChatThread {
  return { id, title: id, at, messages: [{ role: 'user', content: `msg-${id}` }] }
}

describe('lib/chat-history', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('空存储返回 []；新增后按 at 新→旧排序，上限 MAX_THREADS(50) 条', () => {
    expect(getChatThreads()).toEqual([])
    const ids: string[] = []
    for (let i = 1; i <= 51; i++) {
      const id = `t${i}`
      addChatThread(thread(id, i))
      ids.unshift(id)
    }
    expect(getChatThreads().map((t) => t.id)).toEqual(ids.slice(0, 50))
  })

  it('同 id 覆盖更新且置顶', () => {
    addChatThread(thread('a', 1)); addChatThread(thread('b', 2))
    addChatThread({ ...thread('a', 3), title: 'a2' })
    const threads = getChatThreads()
    expect(threads[0].id).toBe('a')
    expect(threads[0].title).toBe('a2')
    expect(threads).toHaveLength(2)
  })

  it('损坏 JSON 返回 [] 不抛异常', () => {
    window.localStorage.setItem('hermes-chat-threads', '{broken')
    expect(getChatThreads()).toEqual([])
  })

  it('非数组/元素缺字段被过滤', () => {
    window.localStorage.setItem('hermes-chat-threads', JSON.stringify([{ id: 'ok', title: 't', at: 1, messages: [] }, { bad: true }]))
    expect(getChatThreads()).toHaveLength(1)
  })

  it('接受 tool/card 留痕消息（content 为 label 或卡片 JSON）', () => {
    addChatThread({
      id: 't-toolcard', title: 'tc', at: 4,
      messages: [
        { role: 'user', content: '查一下杭州银行' },
        { role: 'tool', content: '正在拍摄 X 光（约 6 秒）…', name: 'run_xray' },
        { role: 'card', content: '{"reportId":"600926","name":"杭州银行"}' },
        { role: 'assistant', content: '结论…' },
      ],
    })
    const found = getChatThreads().find((t) => t.id === 't-toolcard')
    expect(found?.messages).toHaveLength(4)
    expect(found?.messages[1]).toMatchObject({ role: 'tool', name: 'run_xray' })
    expect(found?.messages[2].role).toBe('card')
  })
})

describe('deleteChatThread', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('删除指定对话，其余保留', async () => {
    const { addChatThread: add, deleteChatThread: del, getChatThreads: get } = await import('@/lib/chat-history')
    add(thread('a', 1)); add(thread('b', 2)); add(thread('c', 3))
    const rest = del('b')
    expect(rest.map((t) => t.id)).toEqual(['c', 'a'])
    expect(get().map((t) => t.id)).toEqual(['c', 'a'])
  })

  it('删除不存在的 id 无副作用', async () => {
    const { addChatThread: add, deleteChatThread: del } = await import('@/lib/chat-history')
    add(thread('a', 1))
    expect(del('nope').map((t) => t.id)).toEqual(['a'])
  })
})
