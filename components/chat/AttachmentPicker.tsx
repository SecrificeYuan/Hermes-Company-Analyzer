'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, FileSearch, X } from 'lucide-react'
import type { ChatAttachment } from '@/lib/chat-history'

interface Suggestion {
  id: string
  name: string
  stockCode?: string
}

/** 聊天附件选择器：点回形针 → 搜索公司 → 选中变 chip，随下一条消息发送 */
export function AttachmentPicker({
  selected,
  onChange,
}: {
  selected: ChatAttachment[]
  onChange: (next: ChatAttachment[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // 点外部关闭
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  // 防抖搜索
  useEffect(() => {
    if (!open) return
    const query = q.trim()
    if (!query) {
      setResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`)
        const data = (await res.json()) as { suggestions?: Suggestion[] }
        setResults(data.suggestions ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [q, open])

  const add = (s: Suggestion) => {
    if (selected.some((a) => a.id === s.id)) return
    if (selected.length >= 3) return // 上限 3 个，防注入过载
    onChange([...selected, { type: 'company', id: s.id, name: s.name, addedAt: Date.now() }])
    setQ('')
    setResults([])
  }

  const remove = (id: string) => onChange(selected.filter((a) => a.id !== id))

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        title="附加公司资料"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border transition-colors ${
          open || selected.length
            ? 'border-neon/60 text-neon'
            : 'border-ink-edge text-slate-400 hover:border-neon/40 hover:text-neon'
        }`}
      >
        <Building2 className="h-4 w-4" />
        {selected.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neon font-mono text-[10px] text-ink-bg">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-11 left-0 z-20 w-80 rounded-btn border border-ink-edge bg-[#101625] p-2.5 shadow-2xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索公司名 / 股票代码…"
            className="h-9 w-full rounded-btn border border-ink-edge bg-[#0b1020] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-neon"
          />
          <div className="mt-2 max-h-52 overflow-y-auto">
            {loading && <p className="px-2 py-3 text-center font-mono text-xs text-slate-500">搜索中…</p>}
            {!loading && q.trim() && !results.length && (
              <p className="px-2 py-3 text-center font-mono text-xs text-slate-500">未找到匹配主体</p>
            )}
            {!loading && !q.trim() && (
              <p className="px-2 py-3 text-center font-mono text-xs text-slate-500">输入关键词搜索上市 / 工商主体</p>
            )}
            {results.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => add(s)}
                disabled={selected.some((a) => a.id === s.id)}
                className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-ink-card disabled:opacity-40"
              >
                <span className="min-w-0 truncate">{s.name}</span>
                {s.stockCode && <span className="ml-2 shrink-0 font-mono text-xs text-slate-500">{s.stockCode}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** 待发送附件的内联 chip（渲染在输入框内，回形针旁） */
export function AttachmentChips({
  selected,
  onChange,
}: {
  selected: ChatAttachment[]
  onChange: (next: ChatAttachment[]) => void
}) {
  if (!selected.length) return null
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {selected.map((a) => (
        <span
          key={`${a.type}:${a.id}`}
          className="flex min-w-0 shrink items-center gap-1.5 rounded-md border border-neon/40 bg-ink-card/60 py-1 pl-2 pr-1 text-xs text-slate-200"
        >
          {a.type === 'report' ? <FileSearch className="h-3 w-3 shrink-0 text-neon" /> : <Building2 className="h-3 w-3 shrink-0 text-neon" />}
          <span className="max-w-[7rem] truncate">{a.name}</span>
          <span className="shrink-0 rounded bg-ink-edge/50 px-1 font-mono text-[10px] text-slate-400">
            {a.type === 'report' ? '报告' : '公司'}
          </span>
          <button
            type="button"
            onClick={() => onChange(selected.filter((x) => x.id !== a.id))}
            className="shrink-0 text-slate-500 hover:text-slate-200"
            aria-label="移除附件"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
