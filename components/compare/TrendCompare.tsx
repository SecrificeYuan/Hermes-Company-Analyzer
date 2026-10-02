// components/compare/TrendCompare.tsx
'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from '@/components/xray/EChart'
import { baseAxisFor, baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { formatWan } from '@/lib/utils'
import type { CompanyXRay } from '@/lib/types'

function pad(data: number[], n: number): (number | null)[] {
  return Array.from({ length: n }, (_, i) => data[i] ?? null)
}

/**
 * 趋势双线对比：单 EChart 双 grid——上 = 经营现金流多年（A 实线 / B 虚线），
 * 下 = 舆情指数 12 月（min/max ±10，0 中线）。
 * 不用 visualMap（echarts 5.6 pieces 型 + 折线类目轴有渲染崩溃史，见 CashFlowChart 注释）。
 */
export function TrendCompare({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()

  if (a.hp.trend.length === 0 && b.hp.trend.length === 0 && a.morale.trend.length === 0 && b.morale.trend.length === 0) {
    return <ChartEmpty height={440} text="趋势数据暂缺" />
  }

  const cfN = Math.max(a.hp.trend.length, b.hp.trend.length)
  const cfLabels =
    a.hp.labels?.length === cfN ? a.hp.labels
    : b.hp.labels?.length === cfN ? b.hp.labels
    : Array.from({ length: cfN }, (_, i) => `期${i + 1}`)
  const moN = Math.max(a.morale.trend.length, b.morale.trend.length)
  const moLabels =
    a.morale.labels?.length === moN ? a.morale.labels
    : b.morale.labels?.length === moN ? b.morale.labels
    : Array.from({ length: moN }, (_, i) => `期${i + 1}`)

  const base = baseChartOptionFor(t)
  const axis = baseAxisFor(t)

  const line = (data: (number | null)[], color: string, name: string, dashed: boolean) => ({
    name,
    type: 'line' as const,
    data,
    smooth: true,
    symbolSize: 5,
    lineStyle: { width: 2.5, color, type: (dashed ? 'dashed' : 'solid') as 'dashed' | 'solid' },
    itemStyle: { color },
    emphasis: { focus: 'series' as const },
  })

  const option: EChartsOption = {
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis' },
    legend: { top: 0, itemWidth: 16, itemHeight: 8, textStyle: { color: t.colors.textDim, fontSize: 11 } },
    grid: [
      { left: 8, right: 16, top: 34, height: '34%', containLabel: true },
      { left: 8, right: 16, top: '60%', bottom: 4, containLabel: true },
    ],
    xAxis: [
      { type: 'category', data: cfLabels, ...axis, gridIndex: 0 },
      { type: 'category', data: moLabels, ...axis, gridIndex: 1, axisLabel: { ...axis.axisLabel, formatter: (v: string) => v.slice(5) } },
    ],
    yAxis: [
      { type: 'value', ...axis, gridIndex: 0, axisLabel: { ...axis.axisLabel, formatter: (v: number) => formatWan(v) } },
      { type: 'value', min: -10, max: 10, ...axis, gridIndex: 1 },
    ],
    series: [
      { ...line(pad(a.hp.trend, cfN), t.colors.accent, a.name, false), xAxisIndex: 0, yAxisIndex: 0 },
      { ...line(pad(b.hp.trend, cfN), t.colors.textDim, b.name, true), xAxisIndex: 0, yAxisIndex: 0 },
      {
        ...line(pad(a.morale.trend, moN), t.colors.accent, a.name, false),
        xAxisIndex: 1,
        yAxisIndex: 1,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: t.colors.textDim, opacity: 0.5 },
          data: [{ yAxis: 0 }],
          label: { show: false },
        },
      },
      { ...line(pad(b.morale.trend, moN), t.colors.textDim, b.name, true), xAxisIndex: 1, yAxisIndex: 1 },
    ],
  }
  return <EChart option={option} height={440} theme={mode} />
}
