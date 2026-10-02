'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from './EChart'
import { baseAxis, baseChartOption, colors } from '@/lib/theme/echarts-dark'
import type { CompanyXRay } from '@/lib/types'

/** 舆情情绪曲线：0 为中线，上青下红 */
export function SentimentCurve({ morale }: { morale: CompanyXRay['morale'] }) {
  if (morale.trend.length === 0) return <ChartEmpty height={220} text="舆情数据暂缺" />

  const labels = morale.labels ?? morale.trend.map((_, i) => `期${i + 1}`)
  const option: EChartsOption = {
    ...baseChartOption,
    tooltip: { ...baseChartOption.tooltip, trigger: 'axis' },
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      ...baseAxis,
      boundaryGap: false,
      axisLabel: { ...baseAxis.axisLabel, formatter: (v: string) => v.slice(5) },
    },
    yAxis: { type: 'value', min: -10, max: 10, ...baseAxis },
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
          lineStyle: { color: colors.textDim, opacity: 0.5 },
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
      inRange: { color: [colors.danger, colors.safe] },
      seriesIndex: 0,
    },
  }
  return <EChart option={option} height={220} />
}
