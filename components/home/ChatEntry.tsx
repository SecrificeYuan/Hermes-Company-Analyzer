'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Send, Sparkles } from 'lucide-react'
import { addChatThread, getChatThreads, type ChatThread } from '@/lib/chat-history'

const EXAMPLES = ['我妈要买理财', '我想购买 XXX 股票', '帮我看看 XX 健身']

/** 首页对话入口：独立输入框 + 最近对话 chips（跳 /chat?thread=） */
export function ChatEntry({ available }: { available: boolean }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [placeholder] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])

  useEffect(() => {
    setThreads(getChatThreads())
  }, [])

  const submit = () => {
    const q = text.trim()
    if (!q || !available) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const thread: ChatThread = {
      id,
      title: q.slice(0, 24),
      at: Date.now(),
      messages: [{ role: 'user', content: q }],
    }
    setThreads(addChatThread(thread))
    setText('')
    router.push(`/chat?thread=${id}`)
  }

  return (
    <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center">
      <div className="glass-card flex w-full items-center gap-3 px-5 py-4">
        <MessageSquare className="h-5 w-5 text-neon" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          disabled={!available}
          placeholder={available ? `试试：${placeholder}` : 'AI 功能未配置'}
          className="w-full bg-transparent font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!available}
          className="font-mono text-[11px] tracking-wider text-neon hover:underline disabled:opacity-50 disabled:no-underline"
        >
          ASK ⏎
        </button>
      </div>

      {!available && (
        <p className="mt-3 font-mono text-[11px] text-slate-500">AI 功能未配置（缺少 LLM 环境变量）</p>
      )}

      <button
        type="button"
        onClick={() => router.push('/chat')}
        className="mt-4 flex items-center gap-2 rounded-full border border-ink-edge/60 bg-ink-card/40 px-4 py-1.5 text-xs text-slate-300 transition-colors hover:border-neon/60 hover:text-slate-100"
      >
        <Sparkles className="h-3.5 w-3.5 text-neon" />
        与 AI 聊聊
      </button>

      {threads.length > 0 && (
        <div className="mt-6 flex w-full flex-wrap items-center justify-center gap-2">
          <span className="font-mono text-[11px] text-slate-500">最近对话：</span>
          {threads.slice(0, 3).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => router.push(`/chat?thread=${t.id}`)}
              className="rounded-full border border-ink-edge/60 bg-ink-card/40 px-3 py-1 text-xs text-slate-400 transition-colors hover:border-neon/60 hover:text-slate-100"
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
