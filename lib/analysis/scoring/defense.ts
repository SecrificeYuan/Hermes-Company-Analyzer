import type { CompanyXRay, RawCompanyData } from '@/lib/types'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

/** 约定：people 中 event='质押' 的 amount 即累计质押比例（%），取最大值 */
export function extractPledgeRatio(people: RawCompanyData['people']): number {
  if (!people) return 0
  return people
    .filter((p) => p.event === '质押' && typeof p.amount === 'number')
    .reduce((max, p) => Math.max(max, p.amount!), 0)
}

/**
 * DEF 护甲 = 100 - 股权质押比例×0.7 - 高负债惩罚（负债率超 70% 部分 ×1.5）
 * 质押 > 70% 时由 debuff 规则触发「股权质押穿透」。
 */
export function scoreDefense(raw: RawCompanyData): CompanyXRay['def'] {
  const pledgeRatio = extractPledgeRatio(raw.people)
  const years = raw.financial?.years ?? []
  // 财务和股权事件都缺失时，不能把“未知”当作“零负债、零质押”。
  if (years.length === 0 && raw.people === undefined) {
    return { score: 50, label: '数据不足', pledgeRatio: 0, assetCoverage: 0 }
  }
  const debtRatio = years.length > 0 ? years[years.length - 1].debtRatio : 0
  const highDebtPenalty = debtRatio > 70 ? (debtRatio - 70) * 1.5 : 0

  const score = Math.round(clamp(100 - pledgeRatio * 0.7 - highDebtPenalty))
  const label =
    score >= 80 ? '铜墙铁壁' : score >= 60 ? '护甲完好' : score >= 40 ? '护甲磨损' : score >= 20 ? '护甲碎裂' : '无甲裸奔'

  return { score, label, pledgeRatio, assetCoverage: Math.round(clamp(100 - debtRatio)) }
}
