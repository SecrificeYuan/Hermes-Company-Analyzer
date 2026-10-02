'use client'

import type { EChartsOption } from 'echarts'
import { EChart } from './EChart'
import { baseChartOption, colors } from '@/lib/theme/echarts-dark'
import type { CompanyXRay } from '@/lib/types'

/** 五维雷达：HP / DEF / ATK(涉诉) / 士气 / 稳健(100-风险分)，青色半透明填充 */
export function AttributeRadar({ xray }: { xray: CompanyXRay }) {
  const option: EChartsOption = {
    ...baseChartOption,
    radar: {
      indicator: [
        { name: 'HP 血量', max: 100 },
        { name: 'DEF 护甲', max: 100 },
        { name: 'ATK 涉诉', max: 100 },
        { name: '士气', max: 100 },
        { name: '稳健', max: 100 },
      ],
      radius: '68%',
      axisName: { color: colors.textDim, fontSize: 11 },
      splitLine: { lineStyle: { color: colors.gridLine } },
      splitArea: { areaStyle: { color: ['transparent', 'rgba(0,229,255,0.03)'] } },
      axisLine: { lineStyle: { color: colors.gridLine } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [xray.hp.score, xray.def.score, xray.atk.score, xray.morale.score, 100 - xray.riskScore],
            name: '五维属性',
            areaStyle: { color: 'rgba(0,229,255,0.22)' },
            lineStyle: { color: colors.neon, width: 2 },
            itemStyle: { color: colors.neon },
            symbolSize: 5,
          },
        ],
      },
    ],
  }
  return <EChart option={option} height={250} />
}
