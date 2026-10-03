// 复现：流式输出完之后变成两条消息
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import React from 'react'
import { ChatWindow } from '@/components/chat/ChatWindow'
import type { ChatThread } from '@/lib/chat-history'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const encoder = new TextEncoder()
function sseBody(events: unknown[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const ev of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
      controller.close()
    },
  })
}

const thread: ChatThread = { id: 't1', title: '测试', at: Date.now(), messages: [] }

describe('ChatWindow 流式两条消息复现', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    window.localStorage.clear()
    Element.prototype.scrollTo = () => {}
  })

  afterEach(() => {
    root.unmount()
    container.remove()
    vi.unstubAllGlobals()
  })

  it('delta → tool → delta 序列只渲染一条 AI 文本', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sseBody([
      { type: 'delta', text: '先搜一下。' },
      { type: 'tool_start', name: 'confirm_company', label: '正在核对主体…' },
      { type: 'tool_end', name: 'confirm_company' },
      { type: 'delta', text: '最终结论：没问题。' },
    ]), { status: 200 })))

    root = createRoot(container)
    await act(async () => {
      root.render(React.createElement(ChatWindow, { thread, onThreadUpdate: () => {} }))
    })

    // 发送消息触发 runTurn
    const input = container.querySelector('input')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(input, '看看 ST金花')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    // 等流结束
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
      if ((container.textContent ?? '').includes('最终结论：没问题。')) break
    }

    const text = container.textContent ?? ''
    // 修复前：工具调用后的新气泡带着回合级累加器全文，「先搜一下。」出现两次
    expect(text.split('先搜一下。').length - 1).toBe(1)
    expect(text).toContain('最终结论：没问题。')
  }, 15000)
})
