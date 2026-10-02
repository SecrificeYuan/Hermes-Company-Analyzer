// components/compare/DualRadar.tsx
'use client'

import type { EChartsOption } from 'echarts'
import { EChart } from '@/components/xray/EChart'
import { baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

/** 五维口径与单公司版一致；atk 为 lower-better，其余 higher-better（对齐 analyze.ts composite 公式） */
const HIGHER_BETTER = [true, true, false, true, true]

/**
 * 双圈对比雷达：A = accent 实线主圈，B = text-dim 细淡虚线圈（重叠弱化）；
 * 图下方 5 个 diff chip 逐项标差异，▲▼ 按「对 A 有利/不利」着色。
 */
export function DualRadar({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode)

  const val = (x: CompanyXRay) => [x.hp.score, x.def.score, x.atk.score, x.morale.score, 100 - x.riskScore]
  const va = val(a)
  const vb = val(b)

  const option: EChartsOption = {
    ...baseChartOptionFor(t),
    legend: {
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: t.colors.textDim, fontSize: 11 },
    },
    radar: {
      indicator: terms.radarIndicators.map((name) => ({ name, max: 100 })),
      radius: '62%',
      center: ['50%', '44%'],
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
            value: va,
            name: a.name,
            areaStyle: { color: `${t.colors.accent}38` },
            lineStyle: { color: t.colors.accent, width: 2 },
            itemStyle: { color: t.colors.accent },
            symbolSize: 4,
            emphasis: { lineStyle: { width: 3.5 } },
          },
          {
            value: vb,
            name: b.name,
            areaStyle: { color: `${t.colors.textDim}26` },
            lineStyle: { color: t.colors.textDim, width: 1.5, type: 'dashed' },
            itemStyle: { color: t.colors.textDim },
            symbolSize: 3,
            emphasis: { lineStyle: { width: 3 } },
          },
        ],
      },
    ],
  }

  return (
    <div>
      <EChart option={option} height={280} theme={mode} />
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {terms.radarIndicators.map((name, i) => {
          const d = va[i] - vb[i]
          const good = d === 0 ? null : HIGHER_BETTER[i] ? d > 0 : d < 0
          const color = good === null ? t.colors.textFaint : good ? t.colors.safe : t.colors.danger
          return (
            <span
              key={name}
              className="rounded border px-2 py-0.5 font-mono text-[11px]"
              style={{ borderColor: `${color}44`, color }}
            >
              {name} {d === 0 ? '±0' : `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`}
            </span>
          )
        })}
      </div>
    </div>
  )
}
