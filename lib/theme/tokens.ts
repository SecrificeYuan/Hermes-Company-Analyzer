/**
 * 设计 token —— 与 tailwind.config.ts 保持同步（ECharts 等 JS 场景从这里取色）。
 */
export const colors = {
  bg: '#070B14',
  card: '#121A2B',
  edge: 'rgba(0,229,255,0.12)',
  neon: '#00E5FF',
  danger: '#FF3B5C',
  warn: '#FFB020',
  safe: '#00E58A',
  grape: '#8B5CF6',
  textMain: '#E2E8F0',
  textDim: '#7C8DB0',
  gridLine: 'rgba(124,141,176,0.14)',
} as const

export type RiskLevelKey = 'green' | 'yellow' | 'red'

export const riskColor: Record<RiskLevelKey, string> = {
  green: colors.safe,
  yellow: colors.warn,
  red: colors.danger,
}

/** 分数 → 颜色（越低越危险） */
export function scoreColor(score: number): string {
  if (score >= 60) return colors.safe
  if (score >= 30) return colors.warn
  return colors.danger
}
