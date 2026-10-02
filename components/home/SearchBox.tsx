'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listingLabels, type CompanyIdentity, type CompanySearchResult } from '@/lib/company'

export function SearchBox({ onPick }: { onPick: (company: CompanyIdentity) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CompanyIdentity[]>([])
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

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
    setQuery('')
    setItems([])
    onPick(company)
  }
  const run = async (q: string, exact: boolean) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOpen(true)
    setHint('正在查询公开网页和企业披露…')
    try {
      const res = await fetch(`/api/${exact ? 'search' : 'suggest'}?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      const data = await res.json() as CompanySearchResult & { company?: CompanyIdentity; found?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? '公开数据源暂不可用，请稍后重试')
      if (controller.signal.aborted) return
      if (exact && data.found && data.company) { pick(data.company); return }
      setItems(data.suggestions)
      setActive(-1)
      const unavailable = data.sources.some((s) => s.state === 'blocked' || s.state === 'unavailable')
      setHint(data.suggestions.length ? '请选择准确主体；同名企业请核对地区、信用代码与来源。' : unavailable ? '部分来源暂不可用，未能确认该企业。可稍后重试。' : '暂无可核实结果，请尝试完整公司名称、信用代码或股票代码。')
    } catch (error) {
      if (!controller.signal.aborted) { setItems([]); setHint(error instanceof Error ? error.message : '检索失败，请重试') }
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }
  useEffect(() => {
    abortRef.current?.abort()
    setItems([])
    setActive(-1)
    if (query.trim().length < 2) { setLoading(false); setOpen(false); return }
    timerRef.current = setTimeout(() => void run(query.trim(), false), 500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current); abortRef.current?.abort() }
    // run only reads the supplied query; it creates a fresh cancellable request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const submit = () => {
    if (query.trim().length < 2) return
    if (timerRef.current) clearTimeout(timerRef.current)
    void run(query.trim(), true)
  }
  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <div className="glass-card flex items-center gap-3 px-5 py-4">
        <Search className="h-5 w-5 text-neon" />
        <input
          aria-label="搜索公司" role="combobox" aria-expanded={open} aria-controls="company-options"
          aria-autocomplete="list" aria-activedescendant={active >= 0 ? `company-option-${active}` : undefined}
          value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)}
          onFocus={() => { if (items.length || hint) setOpen(true) }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, items.length - 1)) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            else if (event.key === 'Escape') setOpen(false)
            else if (event.key === 'Enter') { event.preventDefault(); if (open && active >= 0 && items[active]) pick(items[active]); else submit() }
          }}
          placeholder="公司名称 / 信用代码 / 股票代码"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <Button type="button" variant="ghost" size="sm" onClick={submit} disabled={query.trim().length < 2 || loading}>
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '搜索'}
        </Button>
      </div>
      {open && (
        <div className="glass-card absolute inset-x-0 top-full z-30 mt-2 max-h-96 overflow-y-auto bg-[#101625]">
          <div role="listbox" id="company-options" aria-label="企业主体">
            {items.map((company, index) => (
              <button key={company.id} id={`company-option-${index}`} role="option" aria-selected={index === active} type="button"
                onMouseDown={(event) => { event.preventDefault(); pick(company) }} onClick={() => pick(company)} onMouseEnter={() => setActive(index)}
                className={`block w-full border-b border-ink-edge px-5 py-3 text-left ${index === active ? 'bg-white/5' : ''}`}>
                <span className="block text-sm font-semibold text-slate-100">{company.fullName ?? company.name}</span>
                {company.fullName && company.name !== company.fullName && <span className="mt-1 block text-xs text-slate-400">来源实体名称：{company.name}</span>}
                <span className="mt-1 block text-xs leading-relaxed text-slate-400">{listingLabels[company.listing]} · {company.stockCode ?? company.creditCode ?? '信用代码待核实'}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{company.region || new URL(company.sources[0]?.url ?? 'https://www.eastmoney.com').hostname} · {company.identity === 'verified' ? '页面主体已核对' : '检索线索，主体待核实'}</span>
              </button>
            ))}
          </div>
          <p role="status" className="px-5 py-3 text-xs leading-relaxed text-slate-400">{hint}</p>
        </div>
      )}
      <p className="mt-3 text-center text-xs text-slate-500">覆盖上市与未上市企业 · 公开资料不足时明确标注</p>
    </div>
  )
}
