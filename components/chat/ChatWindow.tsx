'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { addChatThread, type ChatMessage, type ChatThread } from '@/lib/chat-history'
import { ReportCard, type ReportCardData } from '@/components/chat/ReportCard'

type UiMsg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; label: string }
  | { role: 'card'; card: ReportCardData }

interface SseEvent {
  type?: string
  name?: string
  text?: string
  label?: string
  message?: string
  reportCard?: ReportCardData
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
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [msgs])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setBusy(true)
    setInput('')
    setMsgs((prev) => [...prev, { role: 'user', text: q }])

    const apiMessages: ChatMessage[] = [...thread.messages, { role: 'user', content: q }]
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
      setMsgs((prev) => [...prev, { role: 'assistant', text: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let aiMsgActive = true

      const appendToAi = (delta: string) => {
        aiText += delta
        setMsgs((prev) => {
          const next = [...prev]
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'assistant') {
              next[i] = { role: 'assistant', text: aiText }
              break
            }
          }
          return next
        })
      }

      const finishAi = () => {
        if (!aiMsgActive) return
        aiMsgActive = false
        setMsgs((prev) => {
          const next = [...prev]
          for (let i = next.length - 1; i >= 0; i--) {
            const item = next[i] as Extract<UiMsg, { role: 'assistant' }>
            if (item.role === 'assistant') {
              if (item.text === '') next.splice(i, 1)
              break
            }
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
            finishAi()
            setMsgs((prev) => [...prev, { role: 'tool', label: ev.label ?? ev.name ?? '检索工具' }])
          } else if (ev.type === 'report_card' && ev.reportCard) {
            setMsgs((prev) => [...prev, { role: 'card', card: ev.reportCard as ReportCardData }])
          } else if (ev.type === 'error') {
            appendToAi(ev.message ?? '出错了')
          }
        }
      }
      finishAi()
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

  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-btn bg-neon px-4 py-2.5 text-sm leading-relaxed text-ink-bg">
                {m.text}
              </div>
            </div>
          ) : m.role === 'assistant' ? (
            <div key={i} className="flex justify-start">
              <div className="glass-card max-w-[85%] whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed text-slate-100">
                {m.text || '思考中…'}
              </div>
            </div>
          ) : m.role === 'tool' ? (
            <div key={i} className="flex justify-start">
              <span className="font-mono text-xs text-slate-500">⚙ {m.label}</span>
            </div>
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
