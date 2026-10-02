'use client'

import type { QuoteSnapshot } from '@/lib/data/adapters/market'

function fmt(v: number | null, digits = 2, suffix = ''): string {
  return v === null ? '—' : `${v.toFixed(digits)}${suffix}`
}

function fmtVol(hands: number): string {
  const shares = hands * 100
  if (shares >= 1e8) return `${(shares / 1e8).toFixed(2)}亿`
  if (shares >= 1e4) return `${(shares / 1e4).toFixed(0)}万`
  return `${shares}`
}

function fmtAmount(wan: number): string {
  if (wan >= 10000) return `${(wan / 10000).toFixed(2)}亿`
  return `${wan.toFixed(0)}万`
}

/** 行情快照条：12 项指标网格，数字右对齐终端风 */
export function QuoteStrip({ quote }: { quote: QuoteSnapshot }) {
  const change = quote.price - quote.prevClose
  const changePct = quote.prevClose ? (change / quote.prevClose) * 100 : 0
  const color = change >= 0 ? 'text-safe' : 'text-danger'
  const metrics: [string, string][] = [
    ['今开', fmt(quote.open)],
    ['最高', fmt(quote.high)],
    ['最低', fmt(quote.low)],
    ['成交量', fmtVol(quote.volumeHands)],
    ['总市值', fmt(quote.totalMktCapYi, 2, '亿')],
    ['PE(TTM)', quote.peTtm !== null && quote.peTtm < 0 ? '亏损' : fmt(quote.peTtm, 2)],
    ['昨收', fmt(quote.prevClose)],
    ['换手率', fmt(quote.turnover, 2, '%')],
    ['振幅', fmt(quote.amplitude, 2, '%')],
    ['成交额', fmtAmount(quote.amountWan)],
    ['流通市值', fmt(quote.floatMktCapYi, 2, '亿')],
    ['市净率', fmt(quote.pb, 2)],
  ]
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-3xl font-extrabold tracking-tight">{quote.price.toFixed(3)}</span>
        <span className={`font-mono text-sm font-semibold ${color}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(3)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {quote.time ? `${quote.time.slice(8, 10)}:${quote.time.slice(10, 12)}:${quote.time.slice(12, 14)} 更新 · 15s 轮询` : ''}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-2 sm:grid-cols-4 lg:grid-cols-6">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 border-b border-edge/40 pb-1">
            <span className="font-mono text-[10px] text-slate-500">{label}</span>
            <span className="font-mono text-xs font-semibold text-slate-200">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
