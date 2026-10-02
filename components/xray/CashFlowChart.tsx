'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from './EChart'
import { baseAxisFor, baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { formatWan } from '@/lib/utils'
import type { CompanyXRay } from '@/lib/types'

/** 现金流趋势：渐变面积折线，负值段自动变红 */
export function CashFlowChart({ hp }: { hp: CompanyXRay['hp'] }) {
  const t = useTokens()
  const mode = useMode()

  if (hp.trend.length === 0) return <ChartEmpty height={250} text="财务数据暂缺" />

  const labels = hp.labels ?? hp.trend.map((_, i) => `期${i + 1}`)
  const extent = Math.max(1, ...hp.trend.map((v) => Math.abs(v)))
  const base = baseChartOptionFor(t)
  const axis = baseAxisFor(t)
  const option: EChartsOption = {
    ...base,
    tooltip: {
      ...base.tooltip,
      trigger: 'axis',
      valueFormatter: (v) => formatWan(Number(v)),
    },
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: labels, ...axis, boundaryGap: false },
    yAxis: { type: 'value', ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => formatWan(v) } },
    series: [
      {
        type: 'line',
        data: hp.trend,
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: t.colors.accent },
        itemStyle: { color: t.colors.accent },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${t.colors.accent}59` },
              { offset: 1, color: `${t.colors.accent}00` },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: t.colors.danger, type: 'dashed', opacity: 0.6 },
          data: [{ yAxis: 0 }],
          label: { show: false },
        },
      },
    ],
    // 负值段变红（continuous：echarts 5.6 中 pieces 型 visualMap + 折线类目轴会触发渲染崩溃）
    visualMap: {
      show: false,
      min: -extent,
      max: extent,
      inRange: { color: [t.colors.danger, t.colors.accent] },
      seriesIndex: 0,
    },
  }
  return <EChart option={option} height={250} theme={mode} />
}
