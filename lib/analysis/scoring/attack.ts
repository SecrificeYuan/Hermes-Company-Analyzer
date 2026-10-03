import type { CompanyXRay, RawCompanyData } from '@/lib/types'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

/**
 * ATK 攻击（涉诉攻击值）= 诉讼数量×5 + 被执行金额对数缩放，上限 100。
 * 注意语义：ATK 越高代表法律战火越旺，是风险信号而非褒义。
 */
export function scoreAttack(legal: RawCompanyData['legal']): CompanyXRay['atk'] {
  // 没有司法切片不等于“没有纠纷”。50 仅维持既有数值契约，不能参与任何结论或可视化。
  if (!legal) {
    return { score: 50, label: '暂无法判断', lawsuitCount: 0, executionAmount: 0, available: false }
  }
  const lawsuitCount = legal?.lawsuits.length ?? 0
  const executionAmount = (legal?.executions ?? []).reduce((sum, e) => sum + e.amount, 0)

  const score = Math.round(clamp(lawsuitCount * 5 + Math.log10(1 + executionAmount) * 10))
  const noRecords = lawsuitCount === 0 && legal.executions.length === 0 && legal.dishonest === 0
  const label =
    score >= 70 ? '司法风险信号较多' : score >= 40 ? '司法记录需关注' : score >= 15 ? '有司法记录' : noRecords ? '本次未发现记录' : '有司法记录'

  return { score, label, lawsuitCount, executionAmount, available: true }
}
