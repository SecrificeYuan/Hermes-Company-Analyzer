'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChartNoAxesCombined, ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { industryOptions, type DiscoveryFilters, type FilterMode, type LiteFilters, type ProFilters, type ScreenCandidate, type ScreeningResponse } from '@/lib/screening'
import { listingLabels } from '@/lib/company'
import { Button } from '@/components/ui/button'

const emptyLite: LiteFilters = {
  budget: '', targetReturn: '', risk: '', horizon: '', liquidity: '',
  avoidLoss: false, avoidLawsuits: false, avoidPledge: false,
}

const emptyPro: ProFilters = {
  revenueGrowth: '', netMargin: '', debtRatio: '', currentRatio: '',
  pledgeRatio: '', lawsuitCount: '',
  positiveCashFlow: false, noExecution: false,
}

const inputClass = 'h-10 w-full rounded-btn border border-ink-edge bg-[#0b1020] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-neon'

function countSet(filters: LiteFilters | ProFilters) {
  return Object.values(filters).filter((value) => value !== '' && value !== false).length
}

function NumberField({ label, unit, value, onChange, min = 0, max, step = 1, hint }: {
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  step?: number
  hint?: string
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 flex items-baseline justify-between gap-2 text-sm font-medium text-slate-200">
        <span>{label}</span>
        {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
      </span>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-14`}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{unit}</span>
      </span>
    </label>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const items = [{ value: '', label: '不限' }, ...options]
  const selected = items.find((item) => item.value === value) ?? items[0]
  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
    trigger.current?.focus()
  }
  return (
    <div ref={container} className="relative min-w-0">
      <span id={`${id}-label`} className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-controls={`${id}-options`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            requestAnimationFrame(() => optionRefs.current[Math.max(0, items.findIndex((item) => item.value === value))]?.focus())
          }
          if (event.key === 'Escape') setOpen(false)
        }}
        className={`${inputClass} flex items-center justify-between gap-2 text-left focus-visible:border-neon`}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {open && <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`} className="absolute inset-x-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-btn border border-ink-edge bg-[#0b1020] p-1 shadow-xl">
        {items.map((item, index) => <button
          key={item.value}
          ref={(node) => { optionRefs.current[index] = node }}
          type="button"
          role="option"
          aria-selected={item.value === value}
          onClick={() => choose(item.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              optionRefs.current[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
            }
          }}
          className={`block w-full rounded-btn px-3 py-2 text-left text-sm outline-none hover:bg-white/10 focus:bg-white/10 ${item.value === value ? 'bg-neon/15 text-neon' : 'text-slate-200'}`}
        >{item.label}</button>)}
      </div>}
    </div>
  )
}

function CheckField({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-10 items-center gap-3 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-[#4c8dff]"
      />
      {label}
    </label>
  )
}

export function FilterPanel() {
  const [discovery, setDiscovery] = useState<DiscoveryFilters>({ keyword: '', region: '', industry: '', listing: '' })
  const [mode, setMode] = useState<FilterMode>('lite')
  const [lite, setLite] = useState<LiteFilters>(emptyLite)
  const [pro, setPro] = useState<ProFilters>(emptyPro)
  const [result, setResult] = useState<ScreeningResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const requestRef = useRef<AbortController | null>(null)
  const count = countSet(mode === 'lite' ? lite : pro) + Object.values(discovery).filter(Boolean).length

  useEffect(() => () => requestRef.current?.abort(), [])

  const clearResult = () => {
    requestRef.current?.abort()
    setLoading(false)
    setResult(null)
    setError('')
  }
  const updateLite = <K extends keyof LiteFilters>(key: K, value: LiteFilters[K]) => {
    clearResult()
    setLite((current) => ({ ...current, [key]: value }))
  }
  const updatePro = <K extends keyof ProFilters>(key: K, value: ProFilters[K]) => {
    clearResult()
    setPro((current) => ({ ...current, [key]: value }))
  }
  const selectMode = (next: FilterMode) => {
    clearResult()
    setMode(next)
  }
  const reset = () => {
    clearResult()
    setDiscovery({ keyword: '', region: '', industry: '', listing: '' })
    if (mode === 'lite') setLite(emptyLite)
    else setPro(emptyPro)
  }
  const search = async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const response = await fetch('/api/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'lite' ? { mode, discovery, filters: lite } : { mode, discovery, filters: pro }),
        signal: controller.signal,
      })
      const data = await response.json() as ScreeningResponse & { error?: string }
      if (!response.ok) throw new Error(data.error ?? '查询失败，请稍后重试')
      if (!controller.signal.aborted) setResult(data)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '查询失败，请稍后重试')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <section aria-label="条件筛选" className="w-full max-w-3xl rounded-btn border border-ink-edge bg-[#101625]">
      <div className="flex flex-col gap-4 border-b border-ink-edge px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="inline-grid w-full grid-cols-2 rounded-btn bg-[#0b1020] p-1 sm:w-auto" role="tablist" aria-label="筛选模式">
          <button
            type="button"
            role="tab" aria-selected={mode === 'lite'} aria-controls="lite-filter-fields" tabIndex={mode === 'lite' ? 0 : -1}
            onClick={() => selectMode('lite')}
            className={`flex items-center justify-center gap-2 rounded-btn px-5 py-2 text-sm font-semibold transition-colors ${mode === 'lite' ? 'bg-neon text-ink-bg' : 'text-slate-400 hover:text-slate-100'}`}
          >
            <SlidersHorizontal className="h-4 w-4" /> Lite 模式
          </button>
          <button
            type="button"
            role="tab" aria-selected={mode === 'pro'} aria-controls="pro-filter-fields" tabIndex={mode === 'pro' ? 0 : -1}
            onClick={() => selectMode('pro')}
            className={`flex items-center justify-center gap-2 rounded-btn px-5 py-2 text-sm font-semibold transition-colors ${mode === 'pro' ? 'bg-neon text-ink-bg' : 'text-slate-400 hover:text-slate-100'}`}
          >
            <ChartNoAxesCombined className="h-4 w-4" /> Pro 模式
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span className="text-xs text-slate-400">已设置 {count} 项条件</span>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 重置
          </button>
        </div>
      </div>

      <div className="grid gap-5 border-b border-ink-edge px-5 py-6 sm:grid-cols-2 sm:px-7">
        <label className="block text-sm text-slate-200">企业关键词
          <input value={discovery.keyword} maxLength={60} placeholder="公司名或业务关键词" className={`${inputClass} mt-2`} onChange={(event) => { clearResult(); setDiscovery({ ...discovery, keyword: event.target.value }) }} />
        </label>
        <label className="block text-sm text-slate-200">注册地区
          <input value={discovery.region} maxLength={30} placeholder="如：深圳、江苏" className={`${inputClass} mt-2`} onChange={(event) => { clearResult(); setDiscovery({ ...discovery, region: event.target.value }) }} />
        </label>
        <SelectField label="行业" value={discovery.industry} options={industryOptions} onChange={(value) => { clearResult(); setDiscovery({ ...discovery, industry: value }) }} />
        <SelectField label="上市状态" value={discovery.listing} options={[{ value: 'listed', label: '上市公司' }, { value: 'unlisted', label: '未上市公司' }]} onChange={(value) => { clearResult(); setDiscovery({ ...discovery, listing: value as DiscoveryFilters['listing'] }) }} />
      </div>

      {mode === 'lite' ? (
        <div id="lite-filter-fields" role="tabpanel" className="space-y-6 px-5 py-6 sm:px-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField label="计划投资预算" unit="元" value={lite.budget} onChange={(value) => updateLite('budget', value)} min={0} step={100} />
            <NumberField label="目标年化回报" unit="%" value={lite.targetReturn} onChange={(value) => updateLite('targetReturn', value)} min={0} max={100} hint="目标值" />
            <SelectField label="可接受财务健康风险" value={lite.risk} onChange={(value) => updateLite('risk', value)} options={[
              { value: 'low', label: '低 · 财务指标较稳健' },
              { value: 'medium', label: '中 · 接受部分经营压力' },
              { value: 'high', label: '高 · 可接受明显财务压力' },
            ]} />
            <SelectField label="计划投资期限" value={lite.horizon} onChange={(value) => updateLite('horizon', value)} options={[
              { value: 'short', label: '半年以内' },
              { value: 'medium', label: '半年至两年' },
              { value: 'long', label: '两年以上' },
            ]} />
            <SelectField label="资金使用需求" value={lite.liquidity} onChange={(value) => updateLite('liquidity', value)} options={[
              { value: 'anytime', label: '可能随时需要取用' },
              { value: 'flexible', label: '可保留一段时间' },
              { value: 'long', label: '长期闲置资金' },
            ]} />
          </div>
          <fieldset className="border-t border-ink-edge pt-5">
            <legend className="text-sm font-semibold text-slate-200">希望避开的情况</legend>
            <div className="mt-2 grid gap-x-5 sm:grid-cols-2">
              <CheckField label="最近一年亏损" checked={lite.avoidLoss} onChange={(value) => updateLite('avoidLoss', value)} />
              <CheckField label="近一年诉讼/仲裁公告超过 1 条" checked={lite.avoidLawsuits} onChange={(value) => updateLite('avoidLawsuits', value)} />
              <CheckField label="股东质押比例较高" checked={lite.avoidPledge} onChange={(value) => updateLite('avoidPledge', value)} />
            </div>
          </fieldset>
        </div>
      ) : (
        <div id="pro-filter-fields" role="tabpanel" className="space-y-6 px-5 py-6 sm:px-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField label="营收同比增长不低于" unit="%" value={pro.revenueGrowth} onChange={(value) => updatePro('revenueGrowth', value)} min={-100} max={1000} />
            <NumberField label="净利率不低于" unit="%" value={pro.netMargin} onChange={(value) => updatePro('netMargin', value)} min={-100} max={100} />
            <NumberField label="资产负债率不高于" unit="%" value={pro.debtRatio} onChange={(value) => updatePro('debtRatio', value)} min={0} max={100} />
            <NumberField label="流动比率不低于" unit="倍" value={pro.currentRatio} onChange={(value) => updatePro('currentRatio', value)} min={0} step={0.1} />
            <NumberField label="股东质押比例不高于" unit="%" value={pro.pledgeRatio} onChange={(value) => updatePro('pledgeRatio', value)} min={0} max={100} />
            <NumberField label="近一年诉讼/仲裁公告不高于" unit="条" value={pro.lawsuitCount} onChange={(value) => updatePro('lawsuitCount', value)} min={0} />
          </div>
          <fieldset className="border-t border-ink-edge pt-5">
            <legend className="text-sm font-semibold text-slate-200">硬性条件</legend>
            <div className="mt-2 grid gap-x-5 sm:grid-cols-2">
              <CheckField label="最新年度经营现金流为正" checked={pro.positiveCashFlow} onChange={(value) => updatePro('positiveCashFlow', value)} />
              <CheckField label="已读取的近一年公告中未命中执行标题" checked={pro.noExecution} onChange={(value) => updatePro('noExecution', value)} />
            </div>
          </fieldset>
        </div>
      )}
      <div className="flex flex-col gap-3 border-t border-ink-edge px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <span className="text-xs leading-relaxed text-slate-500">按条件检索公开网页，再核对主体与财务；最多展示 3 家已验证匹配。</span>
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-btn bg-neon px-5 text-sm font-semibold text-ink-bg hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          <Search className="h-4 w-4" /> {loading ? '查询中…' : '查询公司'}
        </button>
      </div>
      <p className="px-5 pb-4 text-xs leading-relaxed text-slate-500 sm:px-7">预算、目标回报及退出需求会逐项核实；缺少投资条款时列入待核实，不会按股票价格推算。司法项仅统计已读取公告，不能证明不存在案件。</p>
      {loading && <p role="status" className="px-5 pb-4 text-sm text-neon sm:px-7">正在发现企业并核对公开资料，通常需要 10–30 秒…</p>}
      {(result || error) && (
        <div aria-live="polite" className="border-t border-ink-edge px-5 py-5 sm:px-7">
          {error ? <p className="text-sm text-danger">{error}</p> : result && (
            <>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-100">符合已验证条件 <span className="text-neon">{result.items.length}</span></h2>
                <span className="text-xs text-slate-500">本次发现 {result.discovered} 家 · 评估 {result.evaluated} 家</span>
              </div>
              {result.items.length === 0 && <p className="py-3 text-sm text-slate-400">本次没有证据充分且满足全部条件的企业。可查看待核实线索，或调整条件重新查询。</p>}
              <ResultList items={result.items} />
              {result.leads.length > 0 && <>
                <h3 className="mb-1 mt-6 text-sm font-semibold text-warn">待核实线索 · {result.leads.length} 家</h3>
                <p className="mb-2 text-xs text-slate-500">以下企业尚不能确认满足全部条件。</p>
                <ResultList items={result.leads} />
              </>}
              <p className="mt-4 text-xs leading-relaxed text-slate-500">{result.scope} 已知不符合条件 {result.excluded} 家。匹配结果不等于投资建议。</p>
              <details className="mt-3 text-xs text-slate-400">
                <summary className="cursor-pointer">查看本次检索来源与状态</summary>
                {result.sources.map((source, index) => <p key={index} className="mt-2 break-words"><a className="text-neon hover:underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> · {source.state === 'ok' ? '可用' : source.state === 'empty' ? '暂无结果' : '访问受限或暂不可用'} {source.note}</p>)}
              </details>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function ResultList({ items }: { items: ScreenCandidate[] }) {
  return <ul className="divide-y divide-ink-edge">
    {items.map((item) => <li key={item.company.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-slate-100">{item.company.fullName ?? item.company.name}</p>
        <p className="mt-1 text-xs text-slate-400">{listingLabels[item.company.listing]} · {item.company.industry || '行业待核实'} · {item.financialRisk === 'low' ? '财务风险较低' : item.financialRisk === 'medium' ? '财务风险中等' : item.financialRisk === 'high' ? '财务风险较高' : '健康评估资料不足'}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.matched.join(' · ')}</p>
        {item.unresolved.length > 0 && <p className="mt-2 text-xs leading-relaxed text-warn">待核实：{item.unresolved.join('；')}</p>}
        <p className="mt-1 text-xs text-slate-500">投资回报：待估算 · 整体投资判断：需进一步尽调</p>
      </div>
      <Button asChild variant="ghost" size="sm" className="shrink-0 self-start">
        <Link href={`/report/${item.company.id}`}>查看报告 <ArrowUpRight className="h-4 w-4" /></Link>
      </Button>
    </li>)}
  </ul>
}
