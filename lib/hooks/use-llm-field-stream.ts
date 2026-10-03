// 报告页 / 对比页共用的 LLM 字段级 SSE 消费 Hook：
// 先探测 /api/llm-status，未配置整块不渲染（返回 llmUp=false）；
// 再读 SSE 字段流进打字机队列（22ms/字）逐字渲染，回放（缓存命中）与实时同一路径；
// 失败兜底 failed=true，调用方自行降级展示。refresh 加 &refresh=1 跳过缓存重新生成。
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface FieldStreamItem {
  slot: string
  text: string
}

export interface FieldStreamMeta {
  model: string
  generatedAt: string
}

const TYPE_MS = 22

export function useLlmFieldStream(
  url: string,
  options?: {
    /** 把某个字段的文本展开成多个队列项（如五维短评 JSON）；返回 null 走默认单字段 */
    expand?: (field: string, text: string) => FieldStreamItem[] | null
    /** 某 slot 完整落地时的回调（如 summary 回填速览层） */
    onSlotDone?: (slot: string, text: string) => void
  },
): {
  llmUp: boolean | null
  failed: boolean
  meta: FieldStreamMeta | null
  display: Record<string, string>
  valueOf: (slot: string) => string | undefined
  regenerate: () => void
  regenerating: boolean
} {
  const [llmUp, setLlmUp] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)
  const [meta, setMeta] = useState<FieldStreamMeta | null>(null)

  const queueRef = useRef<FieldStreamItem[]>([])
  const [typing, setTyping] = useState<{ slot: string; full: string; len: number } | null>(null)
  const [display, setDisplay] = useState<Record<string, string>>({})
  const [tick, setTick] = useState(0)
  const receivedRef = useRef(false)
  const doneRef = useRef(false)
  const [refresh, setRefresh] = useState(0)
  const [regenerating, setRegenerating] = useState(false)

  const expandRef = useRef(options?.expand)
  expandRef.current = options?.expand
  const onSlotDoneRef = useRef(options?.onSlotDone)
  onSlotDoneRef.current = options?.onSlotDone

  const regenerate = useCallback(() => {
    queueRef.current = []
    setDisplay({})
    setTyping(null)
    setFailed(false)
    setMeta(null)
    receivedRef.current = false
    doneRef.current = false
    setRegenerating(true)
    setRefresh((r) => r + 1)
  }, [])

  // 打字机消费循环：tick 驱动取队首，逐字推进，完成即落 display
  useEffect(() => {
    if (typing) {
      if (typing.len >= typing.full.length) {
        const slot = typing.slot
        setDisplay((d) => ({ ...d, [slot]: typing.full }))
        onSlotDoneRef.current?.(slot, typing.full)
        setTyping(null)
        setTick((t) => t + 1)
      } else {
        const timer = window.setTimeout(
          () => setTyping((t) => (t ? { ...t, len: t.len + 1 } : t)),
          TYPE_MS,
        )
        return () => window.clearTimeout(timer)
      }
      return
    }
    const next = queueRef.current.shift()
    if (next) setTyping({ slot: next.slot, full: next.text, len: 0 })
  }, [typing, tick])

  // 拉取 SSE：先探测 llm-status，再读字段流；零事件兜底标失败
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const st = await fetch('/api/llm-status')
        if (!st.ok) {
          setLlmUp(false)
          return
        }
        const status: unknown = await st.json()
        if (cancelled) return
        if (!(status as { available?: boolean })?.available) {
          setLlmUp(false)
          return
        }
        setLlmUp(true)

        const sep = url.includes('?') ? '&' : '?'
        const res = await fetch(`${url}${refresh > 0 ? `${sep}refresh=1` : ''}`)
        if (!res.ok || !res.body) {
          setFailed(true)
          setRegenerating(false)
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const blocks = buf.split('\n\n')
          buf = blocks.pop() ?? ''
          for (const block of blocks) {
            const line = block.trim()
            if (!line.startsWith('data:')) continue
            let ev: { type?: string; field?: string; text?: string; delta?: string; done?: boolean; model?: string; generatedAt?: string; message?: string; cached?: boolean; hasSummary?: boolean }
            try {
              ev = JSON.parse(line.slice(5).trim())
            } catch {
              continue
            }
            if (ev.type === 'field' && ev.field && typeof ev.text === 'string') {
              receivedRef.current = true
              const expanded = expandRef.current?.(ev.field, ev.text)
              if (expanded) {
                queueRef.current.push(...expanded)
              } else {
                queueRef.current.push({ slot: ev.field, text: ev.text })
              }
              setTick((t) => t + 1)
            } else if (ev.type === 'stream' && ev.field && typeof ev.delta === 'string') {
              // 真流式增量：直接推进/初始化对应 slot 的打字机（打字机即流式渲染，天然边到边显）
              receivedRef.current = true
              setTyping((t) =>
                t && t.slot === ev.field
                  ? { ...t, full: t.full + ev.delta! }
                  : { slot: ev.field!, full: ev.delta!, len: 0 },
              )
              setTick((t) => t + 1)
            } else if (ev.type === 'done') {
              doneRef.current = true
              setRegenerating(false)
              if (ev.model && ev.generatedAt) setMeta({ model: ev.model, generatedAt: ev.generatedAt })
            } else if (ev.type === 'error') {
              setFailed(true)
              setRegenerating(false)
            }
          }
        }
        if (!cancelled && !doneRef.current && !receivedRef.current) setFailed(true)
        if (!cancelled) setRegenerating(false)
      } catch {
        if (!cancelled) {
          setFailed(true)
          setRegenerating(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url, refresh])

  /** 渲染值：已完成字段 > 正在打的草稿 > undefined（未开始） */
  const valueOf = useCallback(
    (slot: string): string | undefined => {
      if (display[slot] !== undefined) return display[slot]
      if (typing?.slot === slot) return typing.full.slice(0, typing.len)
      return undefined
    },
    [display, typing],
  )

  return { llmUp, failed, meta, display, valueOf, regenerate, regenerating }
}
