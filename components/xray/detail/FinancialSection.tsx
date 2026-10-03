'use client'
import { CashFlowChart } from '../CashFlowChart'
import { DetailTable } from './DataTable'
import { formatWan } from '@/lib/utils'
import type { CompanyXRay, FinancialYear } from '@/lib/types'
import type { CompanyHealth } from '@/lib/company'

/** 万元/亿 格式化：营收净利现金流用 formatWan，比率直接 % */
function pct(v: number | undefined, digits = 1): string {
  return v === undefined ? '—' : `${v.toFixed(digits)}%`
}

function yoy(years: FinancialYear[], i: number, key: 'revenue' | 'netProfit'): string {
  if (i === 0) return '—'
  const prev = years[i - 1][key]
  if (!prev) return '—'
  const cur = years[i][key]
  const v = ((cur - prev) / Math.abs(prev)) * 100
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

export function FinancialSection({ xray, health }: { xray: CompanyXRay; health?: CompanyHealth }) {
  const years = xray.detail?.financialYears ?? []
  const ordered = [...years].reverse() // 近年在前
  return (
    <div className="space-y-6">
      <CashFlowChart hp={xray.hp} height={280} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="资产负债率" value={health ? pct(health.metrics.debtRatio ?? undefined) : xray.hp.available === false ? '待核实' : pct(xray.hp.debtRatio)} />
        <Metric label="最新经营现金流" value={health ? health.metrics.operatingCashFlow === null ? '待核实' : formatWan(health.metrics.operatingCashFlow) : xray.hp.available === false ? '待核实' : formatWan(xray.hp.cashFlow)} />
        <Metric label={health ? '财务健康风险' : '健康度 HP'} value={health ? health.financialRisk === 'low' ? '较低' : health.financialRisk === 'medium' ? '中等' : health.financialRisk === 'high' ? '较高' : '资料不足' : xray.hp.available === false ? '待核实' : `${xray.hp.score} / 100`} />
      </div>
      <DetailTable
        rows={ordered}
        rowKey={(y) => y.year}
        columns={[
          { key: 'year', label: '年度', render: (y) => y.year },
          { key: 'revenue', label: '营收', align: 'right', render: (y) => formatWan(y.revenue) },
          { key: 'revYoy', label: '营收 YoY', align: 'right', render: (y) => yoy(ordered, ordered.indexOf(y), 'revenue') },
          { key: 'netProfit', label: '净利润', align: 'right', render: (y) => formatWan(y.netProfit) },
          { key: 'margin', label: '净利率', align: 'right', render: (y) => (y.revenue ? `${((y.netProfit / y.revenue) * 100).toFixed(1)}%` : '—') },
          { key: 'ocf', label: '经营现金流', align: 'right', render: (y) => formatWan(y.operatingCashFlow) },
          { key: 'debt', label: '资产负债率', align: 'right', render: (y) => pct(y.debtRatio) },
          { key: 'current', label: '流动比率', align: 'right', render: (y) => (y.currentRatio === undefined ? '—' : y.currentRatio.toFixed(2)) },
        ]}
        empty="░ 财务明细暂缺"
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-btn border border-edge px-3 py-2">
      <div className="font-mono text-[10px] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-slate-200">{value}</div>
    </div>
  )
}
