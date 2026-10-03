'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Crosshair, Search } from 'lucide-react'
import type { ListedCompany } from '@/lib/data/eastmoney'

const DEBOUNCE_MS = 300

type Status = 'idle' | 'loading' | 'ready' | 'unavailable' | 'notfound'

/** 首页搜索框：输入联想候选下拉（/api/suggest），回车精确解析（/api/search） */
export function SearchBox({ onPick }: { onPick: (company: ListedCompany) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ListedCompany[]>([])
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState<Status>('idle')
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

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

  // 下拉定位：portal 到 body，跟随输入框（fixed 坐标）
  useEffect(() => {
    if (!open) return
    const update = () => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPos({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  const pick = (company: ListedCompany) => {
    onPick(company)
    setQuery('')
    setOpen(false)
    setItems([])
    setActive(-1)
    setStatus('idle')
  }

  const submitExact = async () => {
    const q = query.trim()
    if (!q) return
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = (await res.json()) as { found: boolean; company?: ListedCompany }
      if (data.found && data.company) pick(data.company)
      else {
        setOpen(true)
        setStatus('notfound')
      }
    } catch {
      setOpen(true)
      setStatus('unavailable')
    }
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
      else submitExact()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const hint =
    status === 'unavailable'
      ? '数据源暂不可用，请稍后再试'
      : status === 'notfound'
        ? '未找到该公司 —— 试试完整公司名或 6 位股票代码'
        : null

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <div className="glass-card flex items-center gap-3 px-5 py-4">
        <Search className="h-5 w-5 text-neon" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (items.length > 0) setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="输入公司名称或股票代码…"
          className="w-full bg-transparent font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <Crosshair className="h-4 w-4 animate-blink text-neon/60" />
        <button
          type="button"
          onClick={() => void submitExact()}
          className="font-mono text-[11px] tracking-wider text-neon hover:underline"
        >
          SCAN ⏎
        </button>
      </div>
      <a
        href="/compare"
        className="mt-2 inline-block pl-1 font-mono text-xs text-slate-500 transition-colors hover:text-neon"
      >
        去比较 -&gt;
      </a>

      {open && menuPos &&
        createPortal(
          <div
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            className="fixed z-[100] max-h-80 overflow-y-auto rounded-card border border-ink-edge bg-ink-card shadow-xl"
          >
            {items.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(c)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-5 py-3 text-left ${i === active ? 'bg-white/5' : ''} ${i > 0 ? 'border-t border-ink-edge' : ''}`}
              >
                <span className="flex-1 font-semibold text-slate-100">{c.name}</span>
                <span className="font-mono text-xs text-slate-500">{c.stockCode}</span>
              </button>
            ))}
            {hint && <div className="px-5 py-3 text-center font-mono text-xs text-slate-500">{hint}</div>}
            {!hint && status === 'ready' && items.length === 0 && (
              <div className="px-5 py-3 text-center font-mono text-xs text-slate-500">无匹配候选</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
