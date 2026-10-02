'use client'

import type { EChartsOption } from 'echarts'
import { EChart } from './EChart'
import { baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

/** 五维雷达：HP / DEF / ATK(涉诉) / 士气 / 稳健，主色=主题 accent 半透明填充 */
export function AttributeRadar({ xray, height = 250 }: { xray: CompanyXRay; height?: number }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode)

  const option: EChartsOption = {
    ...baseChartOptionFor(t),
    radar: {
      indicator: terms.radarIndicators.map((name) => ({ name, max: 100 })),
      radius: '68%',
      axisName: { color: t.colors.textDim, fontSize: 11 },
      splitLine: { lineStyle: { color: t.colors.gridLine } },
      splitArea: { areaStyle: { color: ['transparent', `${t.colors.accent}08`] } },
      axisLine: { lineStyle: { color: t.colors.gridLine } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [xray.hp.score, xray.def.score, xray.atk.score, xray.morale.score, 100 - xray.riskScore],
            name: terms.radarSeriesName,
            areaStyle: { color: `${t.colors.accent}38` },
            lineStyle: { color: t.colors.accent, width: 2 },
            itemStyle: { color: t.colors.accent },
            symbolSize: 5,
          },
        ],
      },
    ],
  }
  return <EChart option={option} height={height} theme={mode} />
}
