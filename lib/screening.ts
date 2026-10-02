import type { CompanyHealth, PublicSource } from './company'

export type FilterMode = 'lite' | 'pro'
export type DiscoveryFilters = { keyword: string; region: string; industry: string; listing: '' | 'listed' | 'unlisted' }
export type LiteFilters = {
  budget: string; targetReturn: string; risk: string; horizon: string; liquidity: string
  avoidLoss: boolean; avoidLawsuits: boolean; avoidPledge: boolean
}
export type ProFilters = {
  revenueGrowth: string; netMargin: string; debtRatio: string; currentRatio: string
  pledgeRatio: string; lawsuitCount: string; positiveCashFlow: boolean; noExecution: boolean
}
export type ScreeningRequest = { discovery: DiscoveryFilters } & (
  { mode: 'lite'; filters: LiteFilters } | { mode: 'pro'; filters: ProFilters }
)
export type ScreenCandidate = CompanyHealth & { matched: string[]; unresolved: string[] }
export type ScreeningResponse = {
  items: ScreenCandidate[]; leads: ScreenCandidate[]; discovered: number; evaluated: number
  excluded: number; sources: PublicSource[]; queriedAt: string; scope: string
}
export const industryOptions = [
  { value: 'manufacturing', label: '制造业', pattern: '制造|设备|机械|电子|汽车|家电|金属|材料|化工|电池' },
  { value: 'technology', label: '科技与信息服务', pattern: '科技|软件|信息|通信|半导体|计算机|互联网' },
  { value: 'consumer', label: '消费', pattern: '食品|饮料|白酒|零售|消费|家电|纺织|轻工' },
  { value: 'healthcare', label: '医药健康', pattern: '医药|制药|医疗|生物|健康' },
  { value: 'finance', label: '金融', pattern: '银行|保险|证券|金融' },
  { value: 'energy', label: '能源与公用事业', pattern: '能源|电力|煤炭|石油|燃气|公用' },
  { value: 'realestate', label: '房地产', pattern: '房地产|地产|建筑|建材' },
]

export function evaluateMatch(report: CompanyHealth, request: ScreeningRequest): { status: 'matched' | 'unresolved' | 'excluded'; matched: string[]; unresolved: string[] } {
  const matched: string[] = []
  const unresolved: string[] = []
  let failed = false
  const check = (label: string, ok: boolean | null) => {
    if (ok === null) unresolved.push(label)
    else if (ok) matched.push(label)
    else failed = true
  }
  check('企业主体已核对', report.company.identity === 'verified' ? true : null)
  // Every recommendation requires current, applicable financial evidence, even with no thresholds.
  check('财务健康可评估', report.financialRisk !== null ? true : null)
  const d = request.discovery
  if (d.listing) check('上市状态符合要求', report.company.listing === 'unknown' ? null : report.company.listing === d.listing)
  if (d.region) check(`注册地包含 ${d.region}`, report.company.region ? report.company.region.includes(d.region) : null)
  if (d.industry) {
    const pattern = industryOptions.find((i) => i.value === d.industry)!.pattern
    check('行业符合要求', report.company.industry ? new RegExp(pattern).test(report.company.industry) : null)
  }
  if (d.keyword) check(`企业关键词 ${d.keyword}`, `${report.company.fullName ?? report.company.name} ${report.company.industry ?? ''}`.includes(d.keyword) ? true : null)
  const metric = (key: keyof CompanyHealth['metrics'], value: string, label: string, direction: 'min' | 'max') => {
    if (!value) return
    const actual = report.metrics[key]
    check(label, actual === null ? null : direction === 'min' ? actual >= Number(value) : actual <= Number(value))
  }
  const m = report.metrics
  if (request.mode === 'lite') {
    const f = request.filters
    if (f.budget) check('预算与实际投资门槛待核实', null)
    if (f.targetReturn) check('目标回报需要估值、现金流与退出假设', null)
    if (f.horizon || f.liquidity) check('投资期限及退出条款待核实', null)
    if (f.risk) check('财务健康风险符合容忍度', report.financialRisk === null ? null : f.risk === 'high' || report.financialRisk === 'low' || (f.risk === 'medium' && report.financialRisk === 'medium'))
    if (f.avoidLoss) check('最新年度盈利', m.netProfit === null ? null : m.netProfit > 0)
    if (f.avoidLawsuits) metric('lawsuitAnnouncements', '1', '近一年已读取诉讼/仲裁公告不超过 1 条', 'max')
    if (f.avoidPledge) metric('pledgeRatio', '20', '已披露质押比例不超过 20%', 'max')
  } else {
    const f = request.filters
    metric('revenueGrowth', f.revenueGrowth, '营收增长达到要求', 'min')
    metric('netMargin', f.netMargin, '净利率达到要求', 'min')
    metric('debtRatio', f.debtRatio, '资产负债率符合要求', 'max')
    metric('currentRatio', f.currentRatio, '流动比率达到要求', 'min')
    metric('pledgeRatio', f.pledgeRatio, '已披露质押比例符合要求', 'max')
    metric('lawsuitAnnouncements', f.lawsuitCount, '已读取诉讼/仲裁公告数符合要求', 'max')
    if (f.positiveCashFlow) check('经营现金流为正', m.operatingCashFlow === null ? null : m.operatingCashFlow > 0)
    if (f.noExecution) metric('executionAnnouncements', '0', '已读取公告中未命中执行标题', 'max')
  }
  return { status: failed ? 'excluded' : unresolved.length ? 'unresolved' : 'matched', matched, unresolved }
}

const numericRanges: Record<string, [number, number]> = {
  budget: [1, 1e10], targetReturn: [0, 100], revenueGrowth: [-100, 1000], netMargin: [-100, 100],
  debtRatio: [0, 100], currentRatio: [0, 1000], pledgeRatio: [0, 100], lawsuitCount: [0, 10000],
}
export function isScreeningRequest(input: unknown): input is ScreeningRequest {
  if (!input || typeof input !== 'object') return false
  const r = input as Record<string, unknown>
  if (!['lite', 'pro'].includes(String(r.mode)) || !r.filters || typeof r.filters !== 'object' || Array.isArray(r.filters) || !r.discovery || typeof r.discovery !== 'object') return false
  const d = r.discovery as Record<string, unknown>
  if (Object.keys(d).sort().join(',') !== 'industry,keyword,listing,region') return false
  if (typeof d.keyword !== 'string' || typeof d.region !== 'string' || d.keyword.length > 60 || d.region.length > 30 || /[<>\x00-\x1f]/.test(d.keyword + d.region)) return false
  if (!['', 'listed', 'unlisted'].includes(String(d.listing)) || !['', ...industryOptions.map((i) => i.value)].includes(String(d.industry))) return false
  const f = r.filters as Record<string, unknown>
  const expected = r.mode === 'lite'
    ? ['budget', 'targetReturn', 'risk', 'horizon', 'liquidity', 'avoidLoss', 'avoidLawsuits', 'avoidPledge']
    : ['revenueGrowth', 'netMargin', 'debtRatio', 'currentRatio', 'pledgeRatio', 'lawsuitCount', 'positiveCashFlow', 'noExecution']
  if (Object.keys(f).sort().join(',') !== expected.sort().join(',')) return false
  for (const key of expected) {
    const value = f[key]
    if (['avoidLoss', 'avoidLawsuits', 'avoidPledge', 'positiveCashFlow', 'noExecution'].includes(key)) {
      if (typeof value !== 'boolean') return false
    } else if (typeof value !== 'string' || value.length > 40) return false
    if (key in numericRanges && value !== '') {
      const [min, max] = numericRanges[key]
      if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) return false
      if (key === 'lawsuitCount' && !Number.isInteger(Number(value))) return false
    }
  }
  return r.mode === 'pro' || (['', 'low', 'medium', 'high'].includes(String(f.risk)) && ['', 'short', 'medium', 'long'].includes(String(f.horizon)) && ['', 'anytime', 'flexible', 'long'].includes(String(f.liquidity)))
}
