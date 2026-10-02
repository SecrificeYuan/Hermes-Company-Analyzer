import type { CompanyXRay, RawCompanyData } from '@/lib/types'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

/**
 * ATK 攻击（涉诉攻击值）= 诉讼数量×5 + 被执行金额对数缩放，上限 100。
 * 注意语义：ATK 越高代表法律战火越旺，是风险信号而非褒义。
 */
export function scoreAttack(legal: RawCompanyData['legal']): CompanyXRay['atk'] {
  const lawsuitCount = legal?.lawsuits.length ?? 0
  const executionAmount = (legal?.executions ?? []).reduce((sum, e) => sum + e.amount, 0)

  const score = Math.round(clamp(lawsuitCount * 5 + Math.log10(1 + executionAmount) * 10))
  const label =
    score >= 70 ? '战火缠身' : score >= 40 ? '纠纷不断' : score >= 15 ? '偶有摩擦' : '与世无争'

  return { score, label, lawsuitCount, executionAmount }
}
