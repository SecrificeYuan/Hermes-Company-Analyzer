import type { CompanyHealth, CompanyIdentity, PublicSource } from '@/lib/company'
import { assessFinancialHealth, emptyHealth } from '@/lib/health-assessment'
import { financialAdapter } from './adapters/financial'
import { announcementAdapter } from './adapters/cninfo'
import { pledgeAdapter } from './adapters/pledge'
import { companyFromHit, hitFromId, listedProfile, queryFromId, readDiscoveredCompany, searchCompanies } from './company-discovery'
import { resolveCompany } from './eastmoney'
import { findNeeqCompany, getNeeqReport } from './neeq'
import { getWikidataCompany } from './wikidata'

const cache = new Map<string, { expires: number; value: Promise<CompanyHealth> }>()

export async function findCompany(id: string): Promise<CompanyIdentity | null> {
  if (/^neeq_\d{6}$/.test(id)) return findNeeqCompany(id.slice(5))
  if (/^wiki_Q\d+$/.test(id)) return getWikidataCompany(id.slice(5))
  if (id.startsWith('hit_')) {
    const hit = hitFromId(id)
    return hit ? companyFromHit(hit) : null
  }
  if (id.startsWith('query_')) {
    const name = queryFromId(id)
    if (!name) return null
    const result = await searchCompanies(name)
    return result.suggestions.find((item) => item.fullName === name || item.name === name) ?? null
  }
  if (id.startsWith('web_')) return readDiscoveredCompany(id)
  if (!/^\d{6}$/.test(id)) return null
  const profile = await listedProfile(id)
  if (profile) return profile
  try {
    const item = await resolveCompany(id)
    return item ? { ...item, identity: 'verified', listing: 'unknown', sources: [] } : null
  } catch { return null }
}

export async function getCompanyHealth(company: CompanyIdentity): Promise<CompanyHealth> {
  const existing = cache.get(company.id)
  if (existing && existing.expires > Date.now()) {
    const report = await existing.value
    return { ...report, company: { ...report.company, ...company, sources: [...new Map([...report.company.sources, ...company.sources].map((source) => [source.url, source])).values()] } }
  }
  const value = loadCompanyHealth(company)
  if (cache.size >= 150) cache.delete(cache.keys().next().value!)
  cache.set(company.id, { expires: Date.now() + 300_000, value })
  return value
}

async function loadCompanyHealth(company: CompanyIdentity): Promise<CompanyHealth> {
  if (/^neeq_\d{6}$/.test(company.id)) return loadNeeqHealth(company)
  const report = emptyHealth(company)
  if (!/^\d{6}$/.test(company.id) || !company.stockCode || company.identity !== 'verified') {
    if (company.identity !== 'verified') report.gaps.unshift('准确工商主体及统一社会信用代码')
    if (company.listing === 'unknown') report.gaps.unshift('上市状态的明确披露')
    return report
  }
  const [financial, pledge, notices, profile] = await Promise.allSettled([
    financialAdapter.fetch(company.id), pledgeAdapter.fetch(company.id), announcementAdapter.fetch(company.id), listedProfile(company.id),
  ])
  if (profile.status === 'fulfilled' && profile.value) report.company = profile.value
  const years = financial.status === 'fulfilled' ? financial.value?.financial?.years ?? [] : []
  const latest = years.at(-1)
  const previous = years.at(-2)
  const pledgeEvents = pledge.status === 'fulfilled' ? pledge.value?.people : undefined
  const announcements = notices.status === 'fulfilled' ? notices.value?.announcements : undefined
  report.announcements = announcements ?? []
  const cutoff = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)
  const recent = announcements?.filter((item) => item.date >= cutoff)
  const industry = report.company.industry || (financial.status === 'fulfilled' ? financial.value?.meta?.industry : undefined) || ''
  report.company.industry = industry || undefined
  const health = assessFinancialHealth(years, industry, report.asOf)
  report.years = years
  report.financialYear = latest?.year ?? null
  report.financialRisk = health.risk
  report.riskReasons = health.reasons
  if (health.risk === 'high') {
    report.investment = {
      ...report.investment,
      status: 'financial_red_flag',
      reason: `已观察到明显财务警讯：${health.reasons.join('；')}。投资前应核查成因和改善计划；仍缺少估值、交易条款及完整尽调资料，无法估算回报。`,
    }
  }
  report.overall = latest ? 'partial' : 'insufficient'
  report.metrics = {
    revenueGrowth: latest && previous && Number(latest.year) - Number(previous.year) === 1 && previous.revenue > 0 ? (latest.revenue / previous.revenue - 1) * 100 : null,
    netMargin: latest && latest.revenue > 0 ? latest.netProfit / latest.revenue * 100 : null,
    debtRatio: latest?.debtRatio ?? null, currentRatio: latest?.currentRatio ?? null,
    netProfit: latest?.netProfit ?? null, operatingCashFlow: latest?.operatingCashFlow ?? null,
    pledgeRatio: pledgeEvents?.find((item) => item.event === '质押')?.amount ?? null,
    lawsuitAnnouncements: recent ? recent.filter((item) => /诉讼|仲裁/.test(item.title)).length : null,
    executionAnnouncements: recent ? recent.filter((item) => /被执行|强制执行|执行通知|执行裁定/.test(item.title)).length : null,
  }
  if (latest && !health.stale) report.gaps = report.gaps.filter((gap) => gap !== '完整财务报表与审计意见')
  if (health.stale) report.gaps.unshift('近期财务报表；当前指标仅作历史参考')
  if (health.risk === null && latest && !health.stale) report.gaps.unshift(...health.reasons)
  report.gaps.push('财务审计意见、业务竞争力与治理质量的进一步核实')
  if (report.metrics.pledgeRatio !== null) report.gaps = report.gaps.filter((gap) => gap !== '最新股权质押信息')
  const code = `${company.id.startsWith('6') ? 'sh' : 'sz'}${company.id}`
  const makeSource = (title: string, kind: PublicSource['kind'], ok: boolean, url: string, note: string): PublicSource => ({ title, kind, url, state: ok ? 'ok' : 'unavailable', fetchedAt: report.asOf, note })
  report.sources = [...report.company.sources,
    makeSource('东方财富 · 年度财务披露', 'financial', years.length > 0, `https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/Index?type=web&code=${code}`, `财务期：${latest?.year ?? '暂无'}；金额单位为万元。`),
    makeSource('东方财富 · 质押披露', 'ownership', report.metrics.pledgeRatio !== null, `https://data.eastmoney.com/gpzy/detail/${company.id}.html`, '质押披露并非完整股权尽调。'),
    makeSource('东方财富 · 公司公告', 'announcement', announcements !== undefined, `https://data.eastmoney.com/notices/stock/${company.id}.html`, '最近最多 100 条公告中的近一年标题命中数；不是法院案件数，未命中不代表无诉讼。'),
  ]
  return report
}

async function loadNeeqHealth(company: CompanyIdentity): Promise<CompanyHealth> {
  const report = emptyHealth(company)
  try {
    const data = await getNeeqReport(company.id.slice(5))
    report.company = { ...company, ...data.company, sources: data.sources }
    report.sources = data.sources
    report.announcements = data.announcements
    report.years = data.years
    const latest = data.years.at(-1)
    const previous = data.years.at(-2)
    report.financialYear = latest?.year ?? null
    report.overall = latest ? 'partial' : 'insufficient'
    const assessment = assessFinancialHealth(data.years, report.company.industry ?? '', report.asOf)
    report.financialRisk = assessment.risk
    report.riskReasons = assessment.reasons
    report.metrics = {
      revenueGrowth: latest && previous && Number(latest.year) - Number(previous.year) === 1 && previous.revenue > 0 ? (latest.revenue / previous.revenue - 1) * 100 : null,
      netMargin: latest && latest.revenue > 0 ? latest.netProfit / latest.revenue * 100 : null,
      debtRatio: latest?.debtRatio ?? null, currentRatio: latest?.currentRatio ?? null,
      netProfit: latest?.netProfit ?? null, operatingCashFlow: latest?.operatingCashFlow ?? null,
      pledgeRatio: null, lawsuitAnnouncements: null, executionAnnouncements: null,
    }
    if (latest) {
      report.gaps = report.gaps.filter((gap) => gap !== '完整财务报表与审计意见')
      report.gaps.unshift('审计意见原文及财报附注核验')
    } else report.gaps.unshift('年报 PDF 合并三表待核实')
    if (assessment.stale) report.gaps.unshift('近期财务报表；当前指标仅作历史参考')
    if (assessment.risk === 'high') report.investment = {
      ...report.investment, status: 'financial_red_flag',
      reason: `公开年报显示财务警讯：${assessment.reasons.join('；')}。投资前还需核对审计意见、估值、条款与完整尽调。`,
    }
    return report
  } catch (error) {
    report.sources.push({ title: '全国股转系统 · 年报检索', url: 'https://www.neeq.com.cn/m/disclosure/announcement.html', kind: 'financial', state: 'unavailable', fetchedAt: report.asOf, note: error instanceof Error ? error.message : '暂不可用' })
    report.gaps.unshift('挂牌企业年报当前不可用')
    return report
  }
}
