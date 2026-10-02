import type { EChartsOption } from 'echarts'
import type { ThemeTokens } from './types'

/**
 * ECharts 主题基底：按 tokens 生成，替代原 echarts-dark.ts 的静态常量。
 * 用法：const t = useTokens(); { ...baseChartOptionFor(t), ... }
 */
export function baseChartOptionFor(t: ThemeTokens): EChartsOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: t.colors.textDim, fontFamily: 'Inter, system-ui, sans-serif' },
    tooltip: {
      backgroundColor: t.mode === 'pro' ? 'rgba(16,22,37,0.95)' : 'rgba(7,11,20,0.92)',
      borderColor: t.colors.edge,
      textStyle: { color: t.colors.textMain, fontSize: 12 },
      confine: true,
    },
    animationDuration: 600,
    animationEasing: 'cubicOut',
  }
}

export function baseAxisFor(t: ThemeTokens) {
  return {
    axisLine: { lineStyle: { color: t.colors.gridLine } },
    axisTick: { show: false },
    axisLabel: { color: t.colors.textDim, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' },
    splitLine: { lineStyle: { color: t.colors.gridLine, type: 'dashed' as const } },
  }
}
