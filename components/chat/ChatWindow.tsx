'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, HeartPulse, Pencil, ScanLine, Search, Send, ShieldCheck, Trash2, Wrench, type LucideIcon } from 'lucide-react'
import { addChatThread, type ChatMessage, type ChatThread } from '@/lib/chat-history'
import { ReportCard, type ReportCardData } from '@/components/chat/ReportCard'
import { Markdown } from '@/components/chat/Markdown'

type UiMsg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; label: string; name?: string; done?: boolean }
  | { role: 'card'; card: ReportCardData }

interface SseEvent {
  type?: string
  name?: string
  text?: string
  label?: string
  message?: string
  reportCard?: ReportCardData
}

/** 每个工具的专属图标（与 lib/chat/agent.ts 的 TOOL_LABELS 对应） */
const TOOL_ICONS: Record<string, LucideIcon> = {
  suggest_companies: Search,
  confirm_company: ShieldCheck,
  run_xray: ScanLine,
  run_health_check: HeartPulse,
}

export function ChatWindow({
  thread,
  onThreadUpdate,
}: {
  thread: ChatThread
  onThreadUpdate: (t: ChatThread) => void
}) {
  const [msgs, setMsgs] = useState<UiMsg[]>(() =>
    thread.messages
      .filter((m) => m.role !== 'tool')
      .map((m): UiMsg => ({ role: m.role as 'user' | 'assistant', text: m.content ?? '' }))
  )
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmTimer = useRef<number | null>(null)
  /** 本轮流式 AI 气泡在 msgs 中的下标；工具行会移除空气泡，靠它定位而不是从尾部倒搜（否则会改到上一轮的旧气泡） */
  const pendingAiRef = useRef(-1)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [msgs])

  /** 把剩余 UI 消息写回 thread 持久化（tool/card 行不落库） */
  const persistMsgs = (remaining: UiMsg[]) => {
    const messages: ChatMessage[] = remaining
      .filter((m): m is Extract<UiMsg, { role: 'user' }> | Extract<UiMsg, { role: 'assistant' }> => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.text || null }))
    const updated: ChatThread = { ...thread, at: Date.now(), messages }
    addChatThread(updated)
    onThreadUpdate(updated)
  }

  const copyText = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopiedIdx(idx)
    window.setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1500)
  }

  const deleteMsg = (idx: number) => {
    if (busy) return
    const next = msgs.filter((_, j) => j !== idx)
    persistMsgs(next)
    setMsgs(next)
  }

  /** 两步删除：第一次点击进入「确认删除？」，3s 内再点才真正删 */
  const requestDelete = (idx: number) => {
    if (confirmIdx === idx) {
      setConfirmIdx(null)
      deleteMsg(idx)
      return
    }
    setConfirmIdx(idx)
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(() => setConfirmIdx((v) => (v === idx ? null : v)), 3000)
  }

  const editMsg = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  /** 跑一轮 Agent：apiMessages 为送入 /api/chat 的完整消息序列（末条须为 user） */
  const runTurn = async (apiMessages: ChatMessage[]) => {
    setBusy(true)
    let aiText = ''

    const fail = (msg: string) => {
      setMsgs((prev) => [...prev, { role: 'assistant', text: msg }])
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
      if (!res.ok || !res.body) {
        let errMsg = '请求失败，请稍后重试。'
        try {
          const data = await res.json()
          if (data?.available === false) errMsg = 'AI 功能未配置（缺少 LLM 环境变量）。'
          else if (typeof data?.error === 'string') errMsg = data.error
        } catch {
          // 保留默认错误文案
        }
        fail(errMsg)
        return
      }

      // 预置一个等待中的 AI 气泡
      setMsgs((prev) => {
        pendingAiRef.current = prev.length
        return [...prev, { role: 'assistant', text: '' }]
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      const appendToAi = (delta: string) => {
        aiText += delta
        setMsgs((prev) => {
          const idx = pendingAiRef.current
          if (idx >= 0 && idx < prev.length && prev[idx].role === 'assistant') {
            const next = [...prev]
            next[idx] = { role: 'assistant', text: aiText }
            return next
          }
          // 工具进度行之后首个 delta：空气泡已被移除，在末尾新建
          pendingAiRef.current = prev.length
          return [...prev, { role: 'assistant', text: aiText }]
        })
      }

      /** mode='remove'：工具进度行前移除等待气泡；mode='fallback'：流结束兜底，空白则显示错误文案 */
      const finishAi = (mode: 'remove' | 'fallback') => {
        const idx = pendingAiRef.current
        pendingAiRef.current = -1
        if (idx < 0) return
        setMsgs((prev) => {
          if (idx >= prev.length || prev[idx].role !== 'assistant') {
            if (mode === 'fallback') return [...prev, { role: 'assistant', text: '服务暂时无响应，请稍后重试。' }]
            return prev
          }
          const next = [...prev]
          if (next[idx].role === 'assistant' && next[idx].text === '') {
            if (mode === 'remove') next.splice(idx, 1)
            else next[idx] = { role: 'assistant', text: '服务暂时无响应，请稍后重试。' }
          }
          return next
        })
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const blocks = buf.split('\n\n')
        buf = blocks.pop() ?? ''
        for (const block of blocks) {
          const line = block.trim()
          if (!line.startsWith('data:')) continue
          let ev: SseEvent
          try {
            ev = JSON.parse(line.slice(5).trim())
          } catch {
            continue
          }
          if (ev.type === 'delta' && ev.text) {
            appendToAi(ev.text)
          } else if (ev.type === 'tool_start') {
            finishAi('remove')
            setMsgs((prev) => [...prev, { role: 'tool', label: ev.label ?? ev.name ?? '检索工具', name: ev.name }])
          } else if (ev.type === 'tool_end') {
            // 标记最近一条未完成的工具行：停动画、变静态
            setMsgs((prev) => {
              for (let i = prev.length - 1; i >= 0; i--) {
                const item = prev[i]
                if (item.role === 'tool' && !item.done) {
                  const next = [...prev]
                  next[i] = { ...item, done: true }
                  return next
                }
              }
              return prev
            })
          } else if (ev.type === 'report_card' && ev.reportCard) {
            setMsgs((prev) => [...prev, { role: 'card', card: ev.reportCard as ReportCardData }])
          } else if (ev.type === 'error') {
            appendToAi(ev.message ?? '出错了')
          }
        }
      }
      finishAi('fallback')
    } catch {
      fail('网络异常，请稍后重试。')
    } finally {
      setBusy(false)
      const updated: ChatThread = {
        ...thread,
        at: Date.now(),
        messages: [...apiMessages, { role: 'assistant', content: aiText || null }],
      }
      addChatThread(updated)
      onThreadUpdate(updated)
    }
  }

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    setMsgs((prev) => [...prev, { role: 'user', text: q }])
    await runTurn([...thread.messages, { role: 'user', content: q }])
  }

  // 首页新开会话只落了首条 user 消息，挂载后自动补跑 AI 回复；StrictMode 双跑用 ref 挡住
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current) return
    autoRan.current = true
    const last = thread.messages[thread.messages.length - 1]
    if (last?.role === 'user') {
      void runTurn(thread.messages)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="group flex justify-end">
              <div className="max-w-[80%]">
                <div className="rounded-btn bg-neon px-4 py-2.5 text-sm leading-relaxed text-ink-bg">
                  {m.text}
                </div>
                <div className="mt-1 flex items-center justify-end gap-3 font-mono text-[10px] text-slate-500 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button onClick={() => void copyText(m.text, i)} className="flex items-center gap-0.5 hover:text-neon">
                    <Copy className="h-3 w-3" />
                    {copiedIdx === i ? '已复制' : '复制'}
                  </button>
                  <button onClick={() => editMsg(m.text)} className="flex items-center gap-0.5 hover:text-neon">
                    <Pencil className="h-3 w-3" />
                    编辑
                  </button>
                  {!busy && (
                    <button
                      onClick={() => requestDelete(i)}
                      className={`flex items-center gap-0.5 ${confirmIdx === i ? 'font-bold text-red-400' : 'hover:text-red-400'}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      {confirmIdx === i ? '确认删除？' : '删除'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : m.role === 'assistant' ? (
            <div key={i} className="group flex justify-start">
              <div className="max-w-[85%]">
                <div className="glass-card max-w-[85%] px-4 py-2.5">
                  {m.text ? (
                    <Markdown text={m.text} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 py-1 text-slate-400" aria-label="正在思考">
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </span>
                  )}
                </div>
                {m.text !== '' && (
                  <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-slate-500 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <button onClick={() => void copyText(m.text, i)} className="flex items-center gap-0.5 hover:text-neon">
                      <Copy className="h-3 w-3" />
                      {copiedIdx === i ? '已复制' : '复制'}
                    </button>
                    {!busy && (
                      <button
                        onClick={() => requestDelete(i)}
                        className={`flex items-center gap-0.5 ${confirmIdx === i ? 'font-bold text-red-400' : 'hover:text-red-400'}`}
                      >
                        <Trash2 className="h-3 w-3" />
                        {confirmIdx === i ? '确认删除？' : '删除'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : m.role === 'tool' ? (
            (() => {
              const Icon = (m.name && TOOL_ICONS[m.name]) || Wrench
              return (
                <div key={i} className="flex justify-start">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors ${
                      m.done ? 'border-ink-edge/40 bg-ink-card/20' : 'border-ink-edge/60 bg-ink-card/40'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${m.done ? 'text-slate-600' : 'animate-pulse text-neon'}`} />
                    <span className={`font-mono text-[11px] tracking-wide ${m.done ? 'text-slate-600' : 'text-slate-400'}`}>
                      {m.label}
                    </span>
                  </span>
                </div>
              )
            })()
          ) : (
            <div key={i} className="flex justify-start">
              <ReportCard card={m.card} />
            </div>
          )
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="border-t border-ink-edge px-6 py-4"
      >
        <div className="glass-card mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3.5">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder="继续追问，例如：那这家和 XX 比呢？"
            className="w-full bg-transparent font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-neon hover:underline disabled:opacity-50 disabled:no-underline"
          >
            <Send className="h-3.5 w-3.5" />
            SEND ⏎
          </button>
        </div>
      </form>
    </>
  )
}
