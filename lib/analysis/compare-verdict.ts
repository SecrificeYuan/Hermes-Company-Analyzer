// lib/analysis/compare-verdict.ts
/**
 * 双公司对比胜负判定：riskScore（0-100，越低越健康）低者胜；
 * 两家分差 ≤3 视为平局（DRAW）。
 */
export type CompareOutcome = 'A' | 'B' | 'draw'

export function compareVerdict(aScore: number, bScore: number): CompareOutcome {
  if (Math.abs(aScore - bScore) <= 3) return 'draw'
  return aScore < bScore ? 'A' : 'B'
}
