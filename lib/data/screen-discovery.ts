import type { CompanyIdentity, CompanySearchResult, PublicSource } from '@/lib/company'
import { industryOptions, type ScreeningRequest } from '@/lib/screening'
import { deduplicateCompanies, discoverFromWeb, listedProfile, searchCompanies } from './company-discovery'
import { screenWikidata, searchWikidata } from './wikidata'
import { getJson } from './eastmoney'
import { searchNeeq } from './neeq'

const industryNames: Record<string, string[]> = {
  manufacturing: ['工程机械', '专用设备', '通用设备', '汽车零部件', '家电行业', '化学制品', '电池'],
  technology: ['软件开发', '互联网服务', '通信设备', '半导体', '计算机设备', '通信服务'],
  consumer: ['食品饮料', '酿酒行业', '商业百货', '纺织服装', '家电行业'],
  healthcare: ['化学制药', '医疗器械', '生物制品', '中药', '医疗服务'],
  finance: ['银行', '证券', '保险', '多元金融'], energy: ['电力行业', '煤炭行业', '石油行业', '燃气'],
  realestate: ['房地产开发', '房地产服务', '工程建设', '装修建材'],
}
async function discoverListed(request: ScreeningRequest): Promise<CompanySearchResult> {
  const now = new Date()
  const year = now.getMonth() >= 4 ? now.getFullYear() - 1 : now.getFullYear() - 2
  const filters = [`(REPORT_DATE='${year}-12-31')`]
  const industries = industryNames[request.discovery.industry]
  if (industries) filters.push(`(INDUSTRY_NAME in (${industries.map((name) => `"${name}"`).join(',')}))`)
  if (request.mode === 'pro' && request.filters.revenueGrowth) filters.push(`(TOI_RATIO>=${Number(request.filters.revenueGrowth)})`)
  if (request.mode === 'lite' && request.filters.avoidLoss) filters.push('(PARENT_NETPROFIT>0)')
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get')
  url.search = new URLSearchParams({ reportName: 'RPT_DMSK_FN_INCOME', columns: 'ALL', pageSize: '12', pageNumber: '1', sortColumns: 'NOTICE_DATE,SECURITY_CODE', sortTypes: '-1,1', filter: filters.join(''), source: 'WEB', client: 'WEB' }).toString()
  const source: PublicSource = { title: '东方财富 · 按条件检索年度披露', url: url.toString(), kind: 'discovery', fetchedAt: now.toISOString(), state: 'ok', note: '实时检索最近披露的最多 12 家企业，包含上市及发行阶段主体；不代表完整企业名录。' }
  try {
    const json = await getJson(url) as { success?: boolean; result?: { data?: Record<string, unknown>[] } }
    if (!json.success) throw new Error('Source unavailable')
    const suggestions: CompanyIdentity[] = (json.result?.data ?? []).flatMap((row) => {
      const code = String(row.SECURITY_CODE)
      if (!/^\d{6}$/.test(code) || !/\.(SH|SZ)$/.test(String(row.SECUCODE))) return []
      return [{ id: code, name: String(row.SECURITY_NAME_ABBR), stockCode: String(row.SECUCODE), industry: String(row.INDUSTRY_NAME), identity: 'verified', listing: 'unknown', sources: [source] }]
    })
    return { suggestions, sources: [{ ...source, state: suggestions.length ? 'ok' : 'empty' }] }
  } catch { return { suggestions: [], sources: [{ ...source, state: 'unavailable', note: '公开财务检索暂不可用。' }] } }
}
export async function discoverForScreen(request: ScreeningRequest): Promise<CompanySearchResult> {
  const d = request.discovery
  if (d.keyword) return searchCompanies(d.keyword)
  const industry = industryOptions.find((item) => item.value === d.industry)?.label ?? ''
  const query = d.region || industry
  const [web, wiki, conditional, listed, neeq] = await Promise.all([
    discoverFromWeb(query, 6),
    query ? searchWikidata(query) : Promise.resolve({ suggestions: [], sources: [] }),
    screenWikidata(d.region, d.industry),
    d.listing === 'unlisted' ? Promise.resolve({ suggestions: [], sources: [] }) : discoverListed(request),
    d.listing === 'listed' ? Promise.resolve({ suggestions: [], sources: [] }) : searchNeeq(d.region.length >= 2 ? d.region : ''),
  ])
  const list = await Promise.all(listed.suggestions.map(async (company) => await listedProfile(company.id) ?? company))
  const suggestions = deduplicateCompanies([...neeq.suggestions, ...web.suggestions, ...wiki.suggestions, ...conditional.suggestions, ...list])
  return { suggestions, sources: [...neeq.sources, ...web.sources, ...wiki.sources, ...conditional.sources, ...listed.sources] }
}
