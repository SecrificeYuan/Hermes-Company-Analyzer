'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from '../EChart'
import { baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { formatWan } from '@/lib/utils'
import type { FundFlowDay } from '@/lib/data/adapters/market'

const CATS = [
  { key: 'superLarge' as const, label: '超大单' },
  { key: 'large' as const, label: '大单' },
  { key: 'medium' as const, label: '中单' },
  { key: 'small' as const, label: '小单' },
]

/** 资金流向：最新交易日四类订单净流入环形图 + 净流入大数字 */
export function FundFlowDonut({ days, height = 220 }: { days: FundFlowDay[]; height?: number }) {
  const t = useTokens()
  const mode = useMode()
  if (days.length === 0) return <ChartEmpty height={height} text="资金流数据暂缺" />

  const latest = days[days.length - 1]
  // 头条口径用主力净流入（超大单+大单）；四档求和在该数据源下恒为 0，没有信息量
  const net = latest.main
  const retail = latest.medium + latest.small

  const option: EChartsOption = {
    ...baseChartOptionFor(t),
    tooltip: {
      ...baseChartOptionFor(t).tooltip,
      formatter: (p) => {
        const d = p as { name: string; value: number }
        return `${d.name}: ${formatWan(d.value)}`
      },
    },
    series: [
      {
        type: 'pie', radius: ['52%', '74%'], center: ['50%', '50%'],
        label: { show: false }, padAngle: 2, itemStyle: { borderRadius: 4 },
        data: CATS.map((c) => ({
          name: c.label,
          value: Math.abs(latest[c.key]),
          itemStyle: { color: latest[c.key] >= 0 ? t.colors.safe : t.colors.danger, opacity: 0.85 },
        })),
      },
    ],
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <EChart option={option} height={height} theme={mode} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-mono text-sm font-bold ${net >= 0 ? 'text-safe' : 'text-danger'}`}>
            {net >= 0 ? '+' : ''}{formatWan(net)}
          </span>
          <span className="font-mono text-[10px] text-slate-500">主力净流入</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {CATS.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2 font-mono text-xs">
            <span className="text-slate-400">{c.label}</span>
            <span className={latest[c.key] >= 0 ? 'text-safe' : 'text-danger'}>
              {latest[c.key] >= 0 ? '+' : ''}{formatWan(latest[c.key])}
            </span>
          </div>
        ))}
        <div className="!mt-3 flex justify-between border-t border-edge pt-2 font-mono text-[10px] text-slate-500">
          <span className={net >= 0 ? 'text-safe' : 'text-danger'}>主力 {net >= 0 ? '+' : ''}{formatWan(net)}</span>
          <span className={retail >= 0 ? 'text-safe' : 'text-danger'}>散户 {retail >= 0 ? '+' : ''}{formatWan(retail)}</span>
          <span>{latest.date}{latest.source === 'sina' ? ' · 新浪' : ''}</span>
        </div>
      </div>
    </div>
  )
}
