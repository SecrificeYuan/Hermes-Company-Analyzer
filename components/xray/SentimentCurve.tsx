'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from './EChart'
import { baseAxisFor, baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

/** 舆情情绪曲线：0 为中线，上青下红 */
export function SentimentCurve({ morale, height = 220 }: { morale: CompanyXRay['morale']; height?: number }) {
  const t = useTokens()
  const mode = useMode()

  if (morale.trend.length === 0) return <ChartEmpty height={height} text="舆情数据暂缺" />

  const labels = morale.labels ?? morale.trend.map((_, i) => `期${i + 1}`)
  const base = baseChartOptionFor(t)
  const axis = baseAxisFor(t)
  const option: EChartsOption = {
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis' },
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      ...axis,
      boundaryGap: false,
      axisLabel: { ...axis.axisLabel, formatter: (v: string) => v.slice(5) },
    },
    yAxis: { type: 'value', min: -10, max: 10, ...axis },
    series: [
      {
        type: 'line',
        data: morale.trend,
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.18 },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: t.colors.textDim, opacity: 0.5 },
          data: [{ yAxis: 0 }],
          label: { show: false },
        },
      },
    ],
    // continuous：echarts 5.6 中 pieces 型 visualMap + 折线类目轴会触发渲染崩溃
    visualMap: {
      show: false,
      min: -10,
      max: 10,
      inRange: { color: [t.colors.danger, t.colors.safe] },
      seriesIndex: 0,
    },
  }
  return <EChart option={option} height={height} theme={mode} />
}
