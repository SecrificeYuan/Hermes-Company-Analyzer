/** Shared contract for public company discovery and evidence-based health reports. */
export type ListingStatus = 'listed' | 'unlisted' | 'unknown'
export type SourceState = 'ok' | 'blocked' | 'unavailable' | 'empty'
export interface PublicSource {
  title: string
  url: string
  fetchedAt: string
  kind: 'discovery' | 'identity' | 'financial' | 'announcement' | 'ownership'
  state: SourceState
  note?: string
}

export interface CompanyIdentity {
  id: string
  name: string
  fullName?: string
  stockCode?: string
  creditCode?: string
  listing: ListingStatus
  identity: 'verified' | 'lead'
  region?: string
  industry?: string
  foundedAt?: string
  registeredCapital?: string
  legalRepresentative?: string
  businessScope?: string
  description?: string
  website?: string
  sources: PublicSource[]
}

export interface CompanySearchResult {
  suggestions: CompanyIdentity[]
  sources: PublicSource[]
}

export type RiskTier = 'low' | 'medium' | 'high'
export interface CompanyHealth {
  company: CompanyIdentity
  asOf: string
  financialYear: string | null
  years: import('./types').FinancialYear[]
  metrics: {
    revenueGrowth: number | null
    netMargin: number | null
    debtRatio: number | null
    currentRatio: number | null
    netProfit: number | null
    operatingCashFlow: number | null
    pledgeRatio: number | null
    lawsuitAnnouncements: number | null
    executionAnnouncements: number | null
  }
  financialRisk: RiskTier | null
  riskReasons: string[]
  overall: 'partial' | 'insufficient'
  gaps: string[]
  investment: {
    status: 'needs_due_diligence' | 'financial_red_flag'
    annualizedReturn: null
    minimumInvestment: null
    exitMonths: null
    reason: string
  }
  sources: PublicSource[]
  announcements: import('./types').Announcement[]
}

export const listingLabels: Record<ListingStatus, string> = {
  listed: '上市公司', unlisted: '未上市公司', unknown: '上市状态待核实',
}
