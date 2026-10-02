import type { Mode } from '@/lib/mode-store'
import { liteTokens } from './themes/lite'
import { proTokens } from './themes/pro'
import type { ThemeTokens } from './types'

export function getTokens(mode: Mode): ThemeTokens {
  return mode === 'pro' ? proTokens : liteTokens
}

/** 分数 → 颜色（越低越危险），阈值与旧实现一致 */
export function scoreColor(t: ThemeTokens, score: number): string {
  if (score >= 60) return t.riskColor.green
  if (score >= 30) return t.riskColor.yellow
  return t.riskColor.red
}

export type { ThemeTokens, ThemeColors, RiskLevelKey } from './types'
export { liteTokens, proTokens }
