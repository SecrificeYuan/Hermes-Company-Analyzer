// ChatWindow 工具行折叠验证：连续 tool 消息渲染成一个可展开簇，
// 全部完成后收成「已调用 N 个工具」药丸，点击展开逐条列表（对应：多轮工具调用把页面撑得很长）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import React from 'react'
import { ChatWindow } from '@/components/chat/ChatWindow'
import type { ChatThread } from '@/lib/chat-history'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const thread: ChatThread = {
  id: 't1',
  title: '测试',
  at: Date.now(),
  messages: [
    { role: 'user', content: '看看 ST金花' },
    { role: 'tool', content: '正在核对主体…', name: 'confirm_company' },
    { role: 'tool', content: '正在拍摄 X 光（约 6 秒）…', name: 'run_xray' },
    { role: 'tool', content: '正在查询实时行情…', name: 'get_market_quote' },
    { role: 'assistant', content: '典型医药生物公司。' },
  ],
}

function pillText(container: HTMLElement): string {
  return container.textContent ?? ''
}

describe('ChatWindow 工具行折叠', () => {
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

  it('连续工具行收成单个簇，点击展开可见明细', async () => {
    root = createRoot(container)
    await act(async () => {
      root.render(React.createElement(ChatWindow, { thread, onThreadUpdate: () => {} }))
    })

    // 折叠态：一个「已调用 3 个工具」药丸，不逐条铺开
    expect(pillText(container)).toContain('已调用 3 个工具')
    expect(pillText(container)).not.toContain('正在拍摄 X 光')

    // 点击展开：逐条工具行出现；再点收起
    const expandBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('已调用 3 个工具'),
    )!
    await act(async () => {
      expandBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(pillText(container)).toContain('正在核对主体')
    expect(pillText(container)).toContain('正在拍摄 X 光')
    expect(pillText(container)).toContain('正在查询实时行情')

    const collapseBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('收起'),
    )!
    await act(async () => {
      collapseBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(pillText(container)).toContain('已调用 3 个工具')
    expect(pillText(container)).not.toContain('正在拍摄 X 光')
  })
})
