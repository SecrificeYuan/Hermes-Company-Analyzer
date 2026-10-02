import type { Mode } from '@/lib/mode-store'

export type RiskLevelKey = 'green' | 'yellow' | 'red'

export interface ThemeColors {
  bg: string
  card: string
  edge: string
  accent: string
  danger: string
  warn: string
  safe: string
  grape: string
  textMain: string
  textDim: string
  textFaint: string
  gridLine: string
}

export interface ThemeTokens {
  mode: Mode
  colors: ThemeColors
  riskColor: Record<RiskLevelKey, string>
}
