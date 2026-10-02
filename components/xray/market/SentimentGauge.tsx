'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from '../EChart'
import { baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

/** 舆情仪表盘：tone 均值映射 -10..10 → 负向/中性/正向弧形仪表 + 利好利空占比 */
export function SentimentGauge({ xray, height = 150 }: { xray: CompanyXRay; height?: number }) {
  const t = useTokens()
  const mode = useMode()
  const items = xray.detail?.sentimentItems ?? []
  if (items.length === 0) return <ChartEmpty height={height} text="舆情数据暂缺" />

  const pos = items.filter((i) => i.tone > 0).length
  const neg = items.filter((i) => i.tone < 0).length
  const mid = items.length - pos - neg
  const pct = (n: number) => ((n / items.length) * 100).toFixed(0)
  // tone -10..10 → 0..100
  const score = Math.max(0, Math.min(100, ((xray.morale.avgTone + 10) / 20) * 100))
  const lean = xray.morale.avgTone >= 3 ? '正向' : xray.morale.avgTone <= -3 ? '负向' : '中性'
  const leanColor = xray.morale.avgTone >= 3 ? t.colors.safe : xray.morale.avgTone <= -3 ? t.colors.danger : t.colors.textDim

  const option: EChartsOption = {
    ...baseChartOptionFor(t),
    series: [
      {
        type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100,
        radius: '100%', center: ['50%', '72%'],
        progress: { show: true, width: 10, itemStyle: { color: leanColor } },
        axisLine: { lineStyle: { width: 10, color: [[1, t.colors.edge]] } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        pointer: { show: false }, anchor: { show: false },
        detail: { show: false },
        data: [{ value: score }],
      },
    ],
  }

  return (
    <div>
      <div className="relative" style={{ height }}>
        <EChart option={option} height={height} theme={mode} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-xs text-slate-400">近 12 月舆情偏向</span>
          <span className="font-mono text-lg font-bold" style={{ color: leanColor }}>{lean}</span>
        </div>
      </div>
      <div className="mt-2">
        <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-500">
          <span className="text-safe">利好 {pct(pos)}%</span>
          <span>中性 {pct(mid)}%</span>
          <span className="text-danger">利空 {pct(neg)}%</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full">
          <div className="bg-safe/70" style={{ width: `${pct(pos)}%` }} />
          <div className="bg-slate-600/60" style={{ width: `${pct(mid)}%` }} />
          <div className="bg-danger/70" style={{ width: `${pct(neg)}%` }} />
        </div>
      </div>
    </div>
  )
}
