'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { ListedCompany } from '@/lib/data/eastmoney'

const DEBOUNCE_MS = 300

type Status = 'idle' | 'loading' | 'ready' | 'unavailable'

/**
 * 通用公司搜索输入：/api/suggest 联想下拉，选中回调完整公司。
 * 与首页 SearchBox 同套接口，样式收敛为单行输入，供对比页等复用。
 */
export function CompanySearchInput({
  placeholder = '公司名称或股票代码…',
  onPick,
  disabled,
}: {
  placeholder?: string
  onPick: (company: ListedCompany) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ListedCompany[]>([])
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState<Status>('idle')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const q = query.trim()
    abortRef.current?.abort()
    if (!q) {
      setItems([])
      setOpen(false)
      setStatus('idle')
      setActive(-1)
      return
    }
    setStatus('loading')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { suggestions: ListedCompany[] }
        if (ctrl.signal.aborted) return
        setItems(data.suggestions)
        setActive(data.suggestions.length > 0 ? 0 : -1)
        setOpen(true)
        setStatus('ready')
      } catch (e) {
        if (ctrl.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return
        setItems([])
        setActive(-1)
        setOpen(true)
        setStatus('unavailable')
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query])

  const pick = (company: ListedCompany) => {
    onPick(company)
    setQuery('')
    setOpen(false)
    setItems([])
    setActive(-1)
    setStatus('idle')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && active >= 0 && items[active]) pick(items[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const hint =
    status === 'unavailable'
      ? '数据源暂不可用，请稍后再试'
      : status === 'ready' && items.length === 0
        ? '无匹配候选 —— 试试完整公司名或 6 位代码'
        : null

  return (
    <div className="relative w-64">
      <div className="flex items-center gap-2 rounded-btn border border-neon/30 bg-ink-card px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neon/70" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (items.length > 0) setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-card border border-ink-edge bg-ink-card shadow-xl">
          {items.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                pick(c)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-white/5' : ''} ${i > 0 ? 'border-t border-ink-edge' : ''}`}
            >
              <span className="flex-1 truncate font-semibold text-slate-100">{c.name}</span>
              <span className="font-mono text-xs text-slate-500">{c.stockCode}</span>
            </button>
          ))}
          {hint && <div className="px-4 py-2.5 text-center font-mono text-xs text-slate-500">{hint}</div>}
        </div>
      )}
    </div>
  )
}
