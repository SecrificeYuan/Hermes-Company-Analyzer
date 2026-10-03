// useLlmFieldStream 集成验证：mock fetch（llm-status 可用 + report-ai SSE 回放），
// 真实挂载组件驱动打字机，断言 summary 落地（对应 bug：卡死在「AI 正在读这份 X 光片…」）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useLlmFieldStream } from '@/lib/hooks/use-llm-field-stream'
import React from 'react'

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

function Probe({ out }: { out: { value: string | undefined; failed: boolean; llmUp: boolean | null } }) {
  const { llmUp, failed, valueOf } = useLlmFieldStream('/api/report-ai?reportId=t')
  out.llmUp = llmUp
  out.failed = failed
  out.value = valueOf('summary')
  return React.createElement('div')
}

describe('useLlmFieldStream 回放路径', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('llm-status')) {
        return new Response(JSON.stringify({ available: true }), { status: 200 })
      }
      return new Response(sseBody([
        { type: 'stream', field: 'summary', delta: '蓝湾咖啡亮黄灯。', done: true },
        { type: 'field', field: 'lightReason', text: '减持与质押偏高。' },
        { type: 'done', model: 'm', generatedAt: '2026-10-03T00:00:00.000Z', cached: true },
      ]), { status: 200 })
    }))
  })

  afterEach(() => {
    root.unmount()
    container.remove()
    vi.unstubAllGlobals()
  })

  it('summary 逐字落地，不卡占位', async () => {
    const out: { value: string | undefined; failed: boolean; llmUp: boolean | null } = { value: undefined, failed: false, llmUp: null }
    root = createRoot(container)
    await act(async () => { root.render(React.createElement(Probe, { out })) })

    // 等 SSE 到达 + 打字机逐字推进（22ms/字，最多等 5s）
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
      if (out.value === '蓝湾咖啡亮黄灯。') break
    }
    expect(out.llmUp).toBe(true)
    expect(out.failed).toBe(false)
    expect(out.value).toBe('蓝湾咖啡亮黄灯。')
  }, 10000)
})
