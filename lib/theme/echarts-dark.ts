import type { EChartsOption } from 'echarts'
import { colors } from './tokens'

/**
 * ECharts 统一暗色基底配置 —— 所有图表从这里展开，保证终端风一致。
 * 用法：{ ...baseChartOption, xAxis: {...}, series: [...] }
 */
export const baseChartOption: EChartsOption = {
  backgroundColor: 'transparent',
  textStyle: { color: colors.textDim, fontFamily: 'Inter, system-ui, sans-serif' },
  tooltip: {
    backgroundColor: 'rgba(7,11,20,0.92)',
    borderColor: colors.edge,
    textStyle: { color: colors.textMain, fontSize: 12 },
    confine: true,
  },
  animationDuration: 600,
  animationEasing: 'cubicOut',
}

export const baseAxis = {
  axisLine: { lineStyle: { color: colors.gridLine } },
  axisTick: { show: false },
  axisLabel: { color: colors.textDim, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' },
  splitLine: { lineStyle: { color: colors.gridLine, type: 'dashed' as const } },
}

export { colors }
