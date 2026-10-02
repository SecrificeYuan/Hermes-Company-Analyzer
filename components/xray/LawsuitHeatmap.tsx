'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from './EChart'
import { baseAxisFor, baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

const SEV_LABEL = ['low', 'mid', 'high'] as const
const SEV_NAME: Record<(typeof SEV_LABEL)[number], string> = { low: '轻微', mid: '中等', high: '重大' }

/** 诉讼热力图：近 12 个月 × 严重等级，数据取自时间轴的 legal 类事件 */
export function LawsuitHeatmap({
  timeline,
  available = true,
  height = 220,
}: {
  timeline: CompanyXRay['timeline']
  /** 未接入司法切片时，不能以空热力图暗示“没有涉诉记录”。 */
  available?: boolean
  height?: number
}) {
  const t = useTokens()
  const mode = useMode()

  if (!available) return <ChartEmpty height={height} text="司法数据暂不可用，无法判断近 12 个月涉诉情况" />

  const legal = timeline.filter((t) => t.category === 'legal')
  if (legal.length === 0) return <ChartEmpty height={height} text="近 12 个月无涉诉记录" />

  const months = [...new Set(legal.map((t) => t.date.slice(0, 7)))].sort()
  const count = new Map<string, number>()
  for (const t of legal) {
    const key = `${t.date.slice(0, 7)}|${t.severity}`
    count.set(key, (count.get(key) ?? 0) + 1)
  }
  const data: [number, number, number][] = []
  months.forEach((m, x) => {
    SEV_LABEL.forEach((sev, y) => {
      data.push([x, y, count.get(`${m}|${sev}`) ?? 0])
    })
  })
  const max = Math.max(1, ...data.map((d) => d[2]))
  const base = baseChartOptionFor(t)
  const axis = baseAxisFor(t)

  const option: EChartsOption = {
    ...base,
    tooltip: {
      ...base.tooltip,
      formatter: (p) => {
        const v = (p as unknown as { value: [number, number, number] }).value
        return `${months[v[0]]} · ${SEV_NAME[SEV_LABEL[v[1]]]}：${v[2]} 起`
      },
    },
    grid: { left: 8, right: 16, top: 10, bottom: 28, containLabel: true },
    xAxis: { type: 'category', data: months, ...axis, splitLine: { show: false } },
    yAxis: {
      type: 'category',
      data: SEV_LABEL.map((s) => SEV_NAME[s]),
      ...axis,
      splitLine: { show: false },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 8,
      textStyle: { color: t.colors.textDim, fontSize: 10 },
      inRange: { color: [`${t.colors.warn}26`, t.colors.warn, t.colors.danger] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: { show: true, color: t.colors.textMain, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' },
        itemStyle: { borderColor: t.colors.bg, borderWidth: 2, borderRadius: 4 },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: `${t.colors.danger}80` } },
      },
    ],
  }
  return <EChart option={option} height={height} theme={mode} />
}
