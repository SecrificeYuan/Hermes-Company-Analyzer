import { describe, expect, it } from 'vitest'
import { evaluateMatch, isScreeningRequest, type LiteFilters, type ProFilters, type DiscoveryFilters } from '../screening'
import { emptyHealth, assessFinancialHealth } from '../health-assessment'
import type { CompanyIdentity } from '../company'

const company: CompanyIdentity = { id: '600276', name: '恒瑞医药', stockCode: '600276.SH', identity: 'verified', listing: 'listed', industry: '化学制药', region: '江苏连云港', sources: [] }
const health = { ...emptyHealth(company), financialRisk: 'low' as const, financialYear: '2025', metrics: { revenueGrowth: 12, netMargin: 18, debtRatio: 11.5, currentRatio: 3.2, netProfit: 1000, operatingCashFlow: 1200, pledgeRatio: 0.9, lawsuitAnnouncements: 0, executionAnnouncements: 0 } }
const discovery: DiscoveryFilters = { keyword: '', region: '', industry: '', listing: '' }
const lite: LiteFilters = { budget: '', targetReturn: '', risk: '', horizon: '', liquidity: '', avoidLoss: false, avoidLawsuits: false, avoidPledge: false }
const pro: ProFilters = { revenueGrowth: '', netMargin: '', debtRatio: '', currentRatio: '', pledgeRatio: '', lawsuitCount: '', positiveCashFlow: false, noExecution: false }

describe('evidence-based company screening', () => {
  it('matches only verified metrics and handles unknown evidence separately', () => {
    const request = { mode: 'lite' as const, discovery, filters: { ...lite, risk: 'low', avoidLoss: true, avoidPledge: true } }
    expect(evaluateMatch(health, request).status).toBe('matched')
    expect(evaluateMatch({ ...health, metrics: { ...health.metrics, pledgeRatio: null } }, request).status).toBe('unresolved')
    expect(evaluateMatch({ ...health, metrics: { ...health.metrics, netProfit: -1 } }, request).status).toBe('excluded')
    expect(evaluateMatch(emptyHealth(company), { ...request, filters: lite }).status).toBe('unresolved')
  })
  it('never treats a stock lot or a health score as investment terms or return', () => {
    for (const filters of [{ ...lite, budget: '5000' }, { ...lite, targetReturn: '10' }, { ...lite, horizon: 'long' }]) {
      expect(evaluateMatch(health, { mode: 'lite', discovery, filters }).status).toBe('unresolved')
    }
    expect(health.investment.annualizedReturn).toBeNull()
  })
  it('supports Pro minimums, maximums, cashflow and unknown listing states', () => {
    const request = { mode: 'pro' as const, discovery: { ...discovery, industry: 'healthcare' }, filters: { ...pro, revenueGrowth: '10', debtRatio: '40', positiveCashFlow: true } }
    expect(evaluateMatch(health, request).status).toBe('matched')
    expect(evaluateMatch({ ...health, metrics: { ...health.metrics, revenueGrowth: null } }, request).status).toBe('unresolved')
    expect(evaluateMatch(health, { ...request, discovery: { ...discovery, listing: 'unlisted' } }).status).toBe('excluded')
    expect(evaluateMatch({ ...health, company: { ...company, listing: 'unknown' } }, { ...request, discovery: { ...discovery, listing: 'unlisted' } }).status).toBe('unresolved')
  })
  it('rejects invalid fields and fractional case counts', () => {
    expect(isScreeningRequest({ mode: 'lite', discovery, filters: lite })).toBe(true)
    expect(isScreeningRequest({ mode: 'pro', discovery, filters: pro })).toBe(true)
    expect(isScreeningRequest({ mode: 'lite', discovery, filters: { ...lite, budget: '-1' } })).toBe(false)
    expect(isScreeningRequest({ mode: 'pro', discovery, filters: { ...pro, lawsuitCount: '0.5' } })).toBe(false)
    expect(isScreeningRequest({ mode: 'pro', discovery: { ...discovery, listing: 'unknown' }, filters: pro })).toBe(false)
    expect(isScreeningRequest({ mode: 'pro', filters: pro })).toBe(false)
    expect(isScreeningRequest({ mode: 'pro', discovery, filters: { ...pro, pe: '20' } })).toBe(false)
  })
})

describe('financial health assessment', () => {
  const year = { year: '2025', revenue: 200, netProfit: 30, operatingCashFlow: 40, debtRatio: 20, currentRatio: 2 }
  it('distinguishes sound observed finance from loss and cashflow pressure', () => {
    expect(assessFinancialHealth([year], '化学制药', '2026-10-02').risk).toBe('low')
    expect(assessFinancialHealth([{ ...year, operatingCashFlow: -1 }], '化学制药', '2026-10-02').risk).toBe('high')
    expect(assessFinancialHealth([{ ...year, debtRatio: 125 }], '化学制药', '2026-10-02').risk).toBe('high')
  })
  it('does not score missing, stale, or financial-sector data with generic rules', () => {
    expect(assessFinancialHealth([], '科技', '2026-10-02').risk).toBeNull()
    expect(assessFinancialHealth([{ ...year, year: '2023' }], '科技', '2026-10-02').risk).toBeNull()
    expect(assessFinancialHealth([year], '银行', '2026-10-02').risk).toBeNull()
  })
})
