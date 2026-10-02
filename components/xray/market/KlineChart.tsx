'use client'

import { useState } from 'react'
import type { EChartsOption, SeriesOption } from 'echarts'
import { ChartEmpty, EChart } from '../EChart'
import { baseAxisFor, baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { boll, cci, macd, rsi } from '@/lib/analysis/indicators'
import { cn } from '@/lib/utils'
import type { KlineBar } from '@/lib/data/adapters/market'

type Indicator = 'VOL' | 'BOLL' | 'MACD' | 'RSI' | 'CCI'
const TABS: Indicator[] = ['VOL', 'BOLL', 'MACD', 'RSI', 'CCI']

/** 日 K 主图 + 指标副图（tab 切换，指标由收盘价前端派生） */
export function KlineChart({ bars, height = 380 }: { bars: KlineBar[]; height?: number }) {
  const [tab, setTab] = useState<Indicator>('VOL')
  const t = useTokens()
  const mode = useMode()

  if (bars.length === 0) return <ChartEmpty height={height} text="K 线数据暂缺" />

  const dates = bars.map((b) => b.date)
  const closes = bars.map((b) => b.close)
  const up = t.colors.safe
  const down = t.colors.danger
  const base = baseChartOptionFor(t)
  const axis = baseAxisFor(t)

  const candle: EChartsOption = {
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: [
      { left: 8, right: 16, top: 12, height: '52%', containLabel: true },
      { left: 8, right: 16, top: '68%', height: '24%', containLabel: true },
    ],
    xAxis: [
      { type: 'category', data: dates, ...axis, gridIndex: 0 },
      { type: 'category', data: dates, ...axis, gridIndex: 1, axisLabel: { show: false } },
    ],
    yAxis: [
      { scale: true, ...axis, gridIndex: 0 },
      { scale: true, ...axis, gridIndex: 1, splitLine: { show: false } },
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], start: 60, end: 100 }],
    series: [
      {
        name: '日K', type: 'candlestick', xAxisIndex: 0, yAxisIndex: 0,
        data: bars.map((b) => [b.open, b.close, b.low, b.high]),
        itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down },
      },
      {
        name: 'MA20', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: boll(closes).mid,
        showSymbol: false, lineStyle: { width: 1, opacity: 0.7, color: t.colors.accent }, smooth: true,
      },
      {
        name: tab, type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
        data: subData(tab, bars),
        itemStyle: {
          color: (p: { value: unknown }) => {
            const v = Number(Array.isArray(p.value) ? p.value[1] : p.value)
            if (!Number.isFinite(v)) return t.colors.textFaint
            return v >= 0 ? up : down
          },
        },
      },
      ...(subLineSeries(tab, bars, t.colors.accent)),
    ],
  }
  void height
  return (
    <div>
      <div className="mb-2 flex gap-1.5">
        {TABS.map((ind) => (
          <button
            key={ind}
            onClick={() => setTab(ind)}
            className={cn(
              'rounded border px-2 py-0.5 font-mono text-[10px] transition-colors',
              tab === ind ? 'border-neon/60 bg-neon/10 text-neon' : 'border-edge text-slate-500 hover:text-slate-300',
            )}
          >
            {ind}
          </button>
        ))}
      </div>
      <EChart option={candle} height={height} theme={mode} />
    </div>
  )
}

type Bar = { value: number | null }

function subData(tab: Indicator, bars: KlineBar[]): Bar[] {
  if (tab === 'VOL') return bars.map((b) => ({ value: b.volume }))
  if (tab === 'MACD') return macd(bars.map((b) => b.close)).hist.map((v) => ({ value: v }))
  if (tab === 'RSI') return rsi(bars.map((b) => b.close)).map((v) => ({ value: v }))
  if (tab === 'CCI') return cci(bars.map((b) => b.high), bars.map((b) => b.low), bars.map((b) => b.close)).map((v) => ({ value: v }))
  return boll(bars.map((b) => b.close)).upper.map((v) => ({ value: v === null ? null : 0 })) // BOLL 副图用带宽占位
}

function subLineSeries(tab: Indicator, bars: KlineBar[], color: string): SeriesOption[] {
  const closes = bars.map((b) => b.close)
  if (tab === 'BOLL') {
    const { mid, upper, lower } = boll(closes)
    const line = (data: (number | null)[], c: string) => ({
      name: 'boll', type: 'line' as const, xAxisIndex: 1, yAxisIndex: 1, data, showSymbol: false,
      lineStyle: { width: 1, color: c, opacity: 0.8 }, smooth: true,
    })
    return [line(upper, color), line(mid, '#8b94ab'), line(lower, color)]
  }
  if (tab === 'MACD') {
    const { dif, dea } = macd(closes)
    const line = (data: (number | null)[], c: string) => ({
      name: 'macd', type: 'line' as const, xAxisIndex: 1, yAxisIndex: 1, data, showSymbol: false,
      lineStyle: { width: 1, color: c }, smooth: true,
    })
    return [line(dif, color), line(dea, '#ffb020')]
  }
  return []
}
