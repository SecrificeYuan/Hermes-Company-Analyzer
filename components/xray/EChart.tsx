'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { cn } from '@/lib/utils'
import type { Mode } from '@/lib/mode-store'

/**
 * ECharts 轻量封装（替代 echarts-for-react，规避其 React 19 peer 冲突）：
 * 自动 init / setOption / resize / dispose。theme 变化时重建实例以应用新主题基底。
 */
export function EChart({
  option,
  height = 260,
  className,
  theme,
}: {
  option: echarts.EChartsOption
  height?: number
  className?: string
  theme?: Mode
}) {
  const domRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!domRef.current) return
    const chart = echarts.init(domRef.current)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(domRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [theme])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option, theme])

  return <div ref={domRef} style={{ height }} className={cn('w-full', className)} />
}

/** 数据缺失占位：断网/数据为空时图表位显示，保证 UI 不崩 */
export function ChartEmpty({ height = 260, text = '数据暂缺' }: { height?: number; text?: string }) {
  return (
    <div
      style={{ height }}
      className="flex w-full items-center justify-center rounded-lg border border-dashed border-slate-700/60 font-mono text-xs text-slate-500"
    >
      ░ {text} ░
    </div>
  )
}
