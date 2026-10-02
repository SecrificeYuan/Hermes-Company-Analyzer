import type { CompanyXRay, RawCompanyData } from '@/lib/types'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

/**
 * HP 血量 = 经营现金流(0.4) + 流动比率(0.3) + 资产负债率倒数(0.3)
 * 最新年度现金流为负 → 直接扣 40 分（可低于 0 后 clamp 到 0）
 */
export function scoreHp(financial: RawCompanyData['financial']): CompanyXRay['hp'] {
  const years = financial?.years ?? []
  if (years.length === 0) {
    return { score: 50, label: '数据不足', cashFlow: 0, debtRatio: 0, trend: [] }
  }
  const latest = years[years.length - 1]

  const cfRatio = latest.revenue > 0 ? latest.operatingCashFlow / latest.revenue : -1
  const cfScore =
    latest.operatingCashFlow >= 0 ? 60 + 40 * Math.min(cfRatio, 1) : 40 * Math.max(0, 1 + cfRatio)
  // 银行业等不披露流动比率：按中性 50 分计，不把"未知"当作"零流动性"
  const crScore = latest.currentRatio === undefined ? 50 : Math.min(latest.currentRatio / 2, 1) * 100
  const debtScore = clamp(100 - latest.debtRatio)

  let score = 0.4 * cfScore + 0.3 * crScore + 0.3 * debtScore
  if (latest.operatingCashFlow < 0) score -= 40
  score = Math.round(clamp(score))

  const label =
    score >= 80 ? '满血状态' : score >= 60 ? '血条健康' : score >= 40 ? '轻度失血' : score >= 20 ? '重度失血' : '濒死抢救'

  return {
    score,
    label,
    cashFlow: latest.operatingCashFlow,
    debtRatio: latest.debtRatio,
    trend: years.map((y) => y.operatingCashFlow),
    labels: years.map((y) => y.year),
  }
}
