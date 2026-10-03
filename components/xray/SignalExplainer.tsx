'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Markdown } from '@/components/chat/Markdown'

/**
 * 信号 AI 解释展开器：点击「AI 解释」→ 调 /api/signal-explain（SSE 真流式 markdown），
 * 原位展开 100~200 字人话解读。缓存键带 model，换模型自动重生成。
 */
export function SignalExplainer({ reportId, signalId }: { reportId: string; signalId: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    setOpen(true)
    if (loaded || streaming) return
    setStreaming(true)
    setFailed(false)
    try {
      const res = await fetch(
        `/api/signal-explain?reportId=${encodeURIComponent(reportId)}&signalId=${encodeURIComponent(signalId)}`,
      )
      if (!res.ok || !res.body) throw new Error('fetch failed')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const blocks = buf.split('\n\n')
        buf = blocks.pop() ?? ''
        for (const block of blocks) {
          const line = block.trim()
          if (!line.startsWith('data:')) continue
          try {
            const ev = JSON.parse(line.slice(5).trim()) as {
              type?: string
              delta?: string
              message?: string
            }
            if (ev.type === 'stream' && typeof ev.delta === 'string') {
              acc += ev.delta
              setText(acc)
            } else if (ev.type === 'error') {
              setFailed(true)
            }
          } catch {
            // 跳过坏行
          }
        }
      }
      setLoaded(acc.trim().length > 0)
    } catch {
      setFailed(true)
    } finally {
      setStreaming(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={load}
        className="inline-flex items-center gap-1 font-mono text-[10px] text-grape/80 transition-colors hover:text-grape"
      >
        <Sparkles className="h-3 w-3" />
        AI 解释这是什么意思
      </button>
    )
  }

  return (
    <div className="mt-2.5 rounded-md border border-grape/25 bg-grape/5 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-grape/80">AI 解读</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-500 transition-colors hover:text-slate-300"
          aria-label="收起"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1.5 text-xs leading-relaxed text-slate-300">
        {failed && !text ? (
          <p className="text-slate-500">AI 解释暂时不可用，请稍后再试。</p>
        ) : (
          <>
            {text ? <Markdown text={text} /> : <p className="text-slate-500">AI 正在解读…</p>}
            {streaming && (
              <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 animate-pulse bg-grape/70" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
