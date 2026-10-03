// lib/analysis/compare-verdict.ts
/**
 * 双公司对比胜负判定：riskScore（0-100，越低越健康）低者胜；
 * 两家分差 ≤3 视为平局（DRAW）。
 */
import type { CompanyXRay } from '@/lib/types'
import { completeComparisonData } from '@/lib/evidence-availability'

export type CompareOutcome = 'A' | 'B' | 'draw'

export function compareVerdict(aScore: number, bScore: number): CompareOutcome {
  if (Math.abs(aScore - bScore) <= 3) return 'draw'
  return aScore < bScore ? 'A' : 'B'
}

/** 缺少维度时不能用占位分数判定胜负或平局。 */
export function compareCompanyVerdict(a: CompanyXRay, b: CompanyXRay): CompareOutcome | null {
  return completeComparisonData(a) && completeComparisonData(b) ? compareVerdict(a.riskScore, b.riskScore) : null
}
