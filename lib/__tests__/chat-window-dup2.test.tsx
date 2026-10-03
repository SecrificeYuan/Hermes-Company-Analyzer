// 复现2：纯 delta（无工具无卡片）在 StrictMode 下是否变成两条消息
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

function makeEvents(): unknown[] {
  const full = '这是完整回答：杭州银行风险评分 40/100，黄灯，建议分批建仓并设好退出条件。'
  const events: unknown[] = []
  for (let i = 0; i < full.length; i += 3) events.push({ type: 'delta', text: full.slice(i, i + 3) })
  events.push({ type: 'done' })
  return events
}

const thread: ChatThread = { id: 't1', title: '测试', at: Date.now(), messages: [] }

async function drive(root: Root, container: HTMLDivElement) {
  const input = container.querySelector('input')!
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, '这个怎么样')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const form = container.querySelector('form')!
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  const deadline = Date.now() + 3000
  while (Date.now() < deadline) {
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    if ((container.textContent ?? '').includes('退出条件。')) break
  }
}

function aiBubbleCount(container: HTMLDivElement): number {
  // AI 气泡（Markdown 容器）——通过复制按钮倒推太脆，直接数 assistant 段落
  return container.querySelectorAll('.prose').length
}

describe.each([
  ['无 StrictMode', false],
  ['StrictMode', true],
])('纯 delta 流式：%s', (_name, strict) => {
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

  it('只有一条 AI 消息', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sseBody(makeEvents()), { status: 200 })))
    root = createRoot(container)
    await act(async () => {
      const el = React.createElement(ChatWindow, { thread, onThreadUpdate: () => {} })
      root.render(strict ? React.createElement(React.StrictMode, null, el) : el)
    })
    await drive(root, container)
    const text = container.textContent ?? ''
    expect(text.split('退出条件。').length - 1).toBe(1)
    expect(aiBubbleCount(container)).toBe(1)
  }, 15000)
})
