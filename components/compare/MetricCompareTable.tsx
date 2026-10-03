// components/compare/MetricCompareTable.tsx
'use client'

import { formatWan } from '@/lib/utils'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'
import { completeComparisonData, pledgeAvailable } from '@/lib/evidence-availability'

type Direction = 'higher-better' | 'lower-better'

interface Row {
  key: string
  label: string
  a: number
  b: number
  direction: Direction
  format: (v: number) => string
  spark: { a: (number | null)[]; b: (number | null)[] } | null
}

/** 两家 trend 按较长序列对齐，短边补 null（图上自然断线） */
function alignTrend(aData: number[], bData: number[]) {
  const n = Math.max(aData.length, bData.length)
  return {
    a: Array.from({ length: n }, (_, i) => aData[i] ?? null),
    b: Array.from({ length: n }, (_, i) => bData[i] ?? null),
  }
}

/** 行内迷你趋势线（SVG，避免每行一个 ECharts 实例）；数据点 <2 不画 */
function Spark({ data, color }: { data: (number | null)[]; color: string }) {
  const vals = data.filter((v): v is number => v != null)
  if (vals.length < 2) return null
  const w = 120
  const h = 32
  const min = Math.min(...vals)
  const span = Math.max(...vals) - min || 1
  const pts = vals
    .map((v, i) => `${((i * w) / (vals.length - 1)).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(' ')
  return <svg width={w} height={h} className="block"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} /></svg>
}

/**
 * 关键指标对比表：差值列按每行 direction 着色（对 A 有利 → safe / 不利 → danger）。
 * 方向约定对齐 analyze.ts composite 公式（atk、风险分、负债率、质押、被执行 = lower-better）。
 */
export function MetricCompareTable({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode)

  const pct = (v: number) => `${v}%`
  const id = (v: number) => `${v}`

  const cf = alignTrend(a.hp.trend, b.hp.trend)
  const mo = alignTrend(a.morale.trend, b.morale.trend)

  const rows: Row[] = [
    { key: 'hp', label: terms.healthLabel, a: a.hp.score, b: b.hp.score, direction: 'higher-better', format: id, spark: null },
    { key: 'cashflow', label: '经营现金流', a: a.hp.cashFlow, b: b.hp.cashFlow, direction: 'higher-better', format: formatWan, spark: { a: cf.a, b: cf.b } },
    { key: 'debt', label: '资产负债率', a: a.hp.debtRatio, b: b.hp.debtRatio, direction: 'lower-better', format: pct, spark: null },
    { key: 'def', label: terms.defLabel, a: a.def.score, b: b.def.score, direction: 'higher-better', format: id, spark: null },
    { key: 'pledge', label: '质押比例', a: a.def.pledgeRatio, b: b.def.pledgeRatio, direction: 'lower-better', format: pct, spark: null },
    { key: 'coverage', label: '资产覆盖率', a: a.def.assetCoverage, b: b.def.assetCoverage, direction: 'higher-better', format: pct, spark: null },
    { key: 'atk', label: terms.atkLabel, a: a.atk.score, b: b.atk.score, direction: 'lower-better', format: id, spark: null },
    { key: 'lawsuits', label: '诉讼数量', a: a.atk.lawsuitCount, b: b.atk.lawsuitCount, direction: 'lower-better', format: (v) => `${v} 起`, spark: null },
    { key: 'exec', label: '被执行金额', a: a.atk.executionAmount, b: b.atk.executionAmount, direction: 'lower-better', format: formatWan, spark: null },
    { key: 'morale', label: terms.moraleLabel, a: a.morale.score, b: b.morale.score, direction: 'higher-better', format: id, spark: null },
    { key: 'tone', label: 'avgTone（-10~10）', a: a.morale.avgTone, b: b.morale.avgTone, direction: 'higher-better', format: id, spark: { a: mo.a, b: mo.b } },
    { key: 'risk', label: '综合风险分', a: a.riskScore, b: b.riskScore, direction: 'lower-better', format: id, spark: null },
    { key: 'steady', label: '稳健度（100-风险分）', a: 100 - a.riskScore, b: 100 - b.riskScore, direction: 'higher-better', format: id, spark: null },
  ]

  const available = (x: CompanyXRay, key: string): boolean => {
    if (['hp', 'cashflow', 'debt', 'coverage'].includes(key)) return x.hp.available !== false
    if (key === 'def') return x.def.available !== false
    if (key === 'pledge') return pledgeAvailable(x)
    if (['atk', 'lawsuits', 'exec'].includes(key)) return x.atk.available !== false
    if (['morale', 'tone'].includes(key)) return x.morale.available !== false
    return completeComparisonData(x)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          <tr style={{ color: t.colors.textFaint }}>
            <th className="py-2 pr-4 text-left font-normal">指标</th>
            <th className="py-2 pr-4 text-right font-normal">{a.name}</th>
            <th className="py-2 pr-4 text-right font-normal">{b.name}</th>
            <th className="py-2 pr-4 text-right font-normal">差值 A−B</th>
            <th className="py-2 text-right font-normal">趋势</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const aAvailable = available(a, r.key)
            const bAvailable = available(b, r.key)
            const comparable = aAvailable && bAvailable
            const raw = r.a - r.b
            const good = !comparable || raw === 0 ? null : r.direction === 'higher-better' ? raw > 0 : raw < 0
            const color = good === null ? t.colors.textDim : good ? t.colors.safe : t.colors.danger
            return (
              <tr key={r.key} className="border-t" style={{ borderColor: t.colors.edge }}>
                <td className="py-2.5 pr-4" style={{ color: t.colors.textDim }}>{r.label}</td>
                <td className="py-2.5 pr-4 text-right" style={{ color: t.colors.textMain }}>{aAvailable ? r.format(r.a) : '待核实'}</td>
                <td className="py-2.5 pr-4 text-right" style={{ color: t.colors.textMain }}>{bAvailable ? r.format(r.b) : '待核实'}</td>
                <td className="py-2.5 pr-4 text-right" style={{ color }}>
                  {!comparable ? '无法比较' : raw === 0 ? '±0' : `${raw > 0 ? '▲' : '▼'} ${r.format(Math.abs(raw))}`}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    {r.spark ? (
                      <>
                        {aAvailable && <Spark data={r.spark.a} color={t.colors.accent} />}
                        {bAvailable && <Spark data={r.spark.b} color={t.colors.textDim} />}
                      </>
                    ) : (
                      <span style={{ color: t.colors.textFaint }}>—</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
