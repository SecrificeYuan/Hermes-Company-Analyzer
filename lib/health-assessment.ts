import type { CompanyHealth, CompanyIdentity, RiskTier } from './company'
import type { FinancialYear } from './types'

export function assessFinancialHealth(years: FinancialYear[], industry: string, asOf: string): {
  risk: RiskTier | null; reasons: string[]; stale: boolean
} {
  const latest = years.at(-1)
  if (!latest) return { risk: null, reasons: ['缺少可核实的完整年度财务数据'], stale: false }
  const stale = new Date(asOf).getTime() - new Date(`${latest.year}-12-31`).getTime() > 550 * 86400_000
  if (stale) return { risk: null, reasons: [`最新可用财报为 ${latest.year} 年，时效不足`], stale }
  if (/银行|保险|证券|金融|多元金融/.test(industry)) return { risk: null, reasons: ['金融企业需要资本充足率、不良率等专门指标，通用财务规则不适用'], stale }
  if ([latest.netProfit, latest.operatingCashFlow, latest.debtRatio, latest.revenue].some((v) => !Number.isFinite(v))) {
    return { risk: null, reasons: ['关键财务指标缺失'], stale }
  }
  const reasons: string[] = []
  let risk: RiskTier = 'low'
  if (latest.netProfit <= 0) { risk = 'high'; reasons.push('最新年度未盈利') }
  if (latest.operatingCashFlow <= 0) { risk = 'high'; reasons.push('最新年度经营现金流非正') }
  if (latest.debtRatio >= 75) { risk = 'high'; reasons.push('资产负债率达到 75% 及以上') }
  else if (latest.debtRatio >= 50) { if (risk === 'low') risk = 'medium'; reasons.push('资产负债率达到 50% 及以上') }
  if (latest.currentRatio !== undefined && latest.currentRatio < 1) { if (risk === 'low') risk = 'medium'; reasons.push('流动资产不足以覆盖流动负债') }
  const previous = years.at(-2)
  if (previous && Number(previous.year) === Number(latest.year) - 1 && previous.revenue > 0 && latest.revenue / previous.revenue < 0.9) {
    if (risk === 'low') risk = 'medium'
    reasons.push('营业收入同比下降超过 10%')
  }
  if (!reasons.length) reasons.push('最新年度盈利、经营现金流为正，资产负债率低于 50%')
  return { risk, reasons, stale }
}

export function emptyHealth(company: CompanyIdentity): CompanyHealth {
  return {
    company, asOf: new Date().toISOString(), years: [], financialYear: null,
    metrics: { revenueGrowth: null, netMargin: null, debtRatio: null, currentRatio: null, netProfit: null, operatingCashFlow: null, pledgeRatio: null, lawsuitAnnouncements: null, executionAnnouncements: null },
    overall: 'insufficient', financialRisk: null, riskReasons: ['缺少可核实的完整年度财务数据'],
    gaps: ['完整财务报表与审计意见', '完整司法、执行与经营异常记录', '完整股权结构与控制关系', '最新股权质押信息', '投资估值、持股比例、分红与退出条款'],
    investment: { status: 'needs_due_diligence', annualizedReturn: null, minimumInvestment: null, exitMonths: null, reason: '尚不能判断是否值得投资。健康评估不能直接换算投资回报率；需要估值、投资额、持股比例、可分配现金流及退出假设。' },
    sources: [...company.sources], announcements: [],
  }
}
