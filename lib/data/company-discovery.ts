import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { load } from 'cheerio'
import type { CompanyIdentity, CompanySearchResult, ListingStatus } from '@/lib/company'
import { getJson, suggestCompanies } from './eastmoney'
import { fetchPublicPage, PublicWebError, searchPublicDirectory, type WebHit } from './public-web'
import { searchWikidata } from './wikidata'
import { searchNeeq } from './neeq'

const recordsDir = path.join(process.cwd(), '.data', 'companies')
const searchCache = new Map<string, { expires: number; value: Promise<CompanySearchResult> }>()
const profiles = new Map<string, { expires: number; value: Promise<CompanyIdentity | null> }>()

export function listingFromProfile(row: Record<string, unknown>, now = new Date()): ListingStatus {
  const date = typeof row.LISTING_DATE === 'string' ? new Date(row.LISTING_DATE.slice(0, 10)) : null
  if (row.LISTING_STATE === '0' && date && date <= now) return 'listed'
  if (row.LISTING_STATE === '9' && !row.STR_CODEH && !row.STR_CODEB) return 'unlisted'
  return 'unknown'
}

export function validCreditCode(value: string): boolean {
  const chars = '0123456789ABCDEFGHJKLMNPQRTUWXY'
  const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(value)) return false
  const sum = weights.reduce((total, weight, index) => total + weight * chars.indexOf(value[index]), 0)
  return chars[(31 - sum % 31) % 31] === value[17]
}

export function legalName(title: string): string | null {
  return title.match(/^([\u4e00-\u9fffA-Za-z0-9（）()·]{2,70}?(?:股份有限公司|有限责任公司|有限公司))/)?.[1] ?? null
}
function normalizeName(name: string) { return name.replace(/\(/g, '（').replace(/\)/g, '）').replace(/\s/g, '') }

function labeled(text: string, labels: string[]): string | undefined {
  const pattern = labels.join('|')
  return text.match(new RegExp(`(?:${pattern})\\s*[：:]\\s*([^；。\\n]{2,120})`))?.[1]?.trim()
}

export function deduplicateCompanies(items: CompanyIdentity[]): CompanyIdentity[] {
  const merged = new Map<string, CompanyIdentity>()
  for (const item of items) {
    // A shared name alone cannot establish that two records refer to the same legal entity.
    const existingKey = [...merged.entries()].find(([, old]) => old.id === item.id || (old.stockCode && old.stockCode === item.stockCode) || (old.creditCode && old.creditCode === item.creditCode))?.[0]
    const key = existingKey ?? (item.creditCode ? `credit:${item.creditCode}` : item.stockCode ? `stock:${item.stockCode}` : item.id)
    const old = merged.get(key)
    if (!old) merged.set(key, item)
    else {
      const preferred = old.stockCode ? old : item.stockCode ? item : old.identity === 'verified' ? old : item
      merged.set(key, {
        ...preferred,
        fullName: preferred.fullName || old.fullName || item.fullName,
        creditCode: preferred.creditCode || old.creditCode || item.creditCode,
        region: preferred.region || old.region || item.region,
        industry: preferred.industry || old.industry || item.industry,
        foundedAt: preferred.foundedAt || old.foundedAt || item.foundedAt,
        registeredCapital: preferred.registeredCapital || old.registeredCapital || item.registeredCapital,
        legalRepresentative: preferred.legalRepresentative || old.legalRepresentative || item.legalRepresentative,
        businessScope: preferred.businessScope || old.businessScope || item.businessScope,
        description: preferred.description || old.description || item.description,
        website: preferred.website || old.website || item.website,
        sources: [...new Map([...old.sources, ...item.sources].map((s) => [s.url, s])).values()],
      })
    }
  }
  return [...merged.values()]
}

/** Legacy links only. New discoveries use source ids and never write a company database. */
export async function readDiscoveredCompany(id: string): Promise<CompanyIdentity | null> {
  if (!/^web_[a-f0-9]{40}$/.test(id)) return null
  try {
    const company = JSON.parse(await readFile(path.join(recordsDir, `${id}.json`), 'utf8')) as CompanyIdentity
    return company.id === id && typeof company.name === 'string' && Array.isArray(company.sources) ? company : null
  } catch { return null }
}

export function hitId(hit: WebHit): string {
  return `hit_${Buffer.from(JSON.stringify([hit.url, hit.title]), 'utf8').toString('base64url')}`
}

export function hitFromId(id: string): WebHit | null {
  if (!/^hit_[A-Za-z0-9_-]{20,600}$/.test(id)) return null
  try {
    const row = JSON.parse(Buffer.from(id.slice(4), 'base64url').toString('utf8')) as unknown
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || typeof row[1] !== 'string') return null
    const url = new URL(row[0])
    const qcc = url.origin === 'https://www.qcc.com' && /^\/firm\/[a-z0-9]+\.html$/.test(url.pathname)
    const ncss = url.origin === 'https://www.ncss.cn' && /^\/ncss\/keyunits\/\d{6}\/\d{8}\/\d+\.html$/.test(url.pathname)
    if ((!qcc && !ncss) || !legalName(row[1])) return null
    return { url: url.toString(), title: row[1], snippet: '' }
  } catch { return null }
}

export function queryId(name: string): string { return `query_${Buffer.from(name, 'utf8').toString('base64url')}` }
export function queryFromId(id: string): string | null {
  if (!/^query_[A-Za-z0-9_-]{4,240}$/.test(id)) return null
  const name = Buffer.from(id.slice(6), 'base64url').toString('utf8')
  return name.length <= 80 && legalName(name) === name ? name : null
}

export async function listedProfile(query: string): Promise<CompanyIdentity | null> {
  const existing = profiles.get(query)
  if (existing && existing.expires > Date.now()) return existing.value
  const value = (async () => {
    if (!/^[\u4e00-\u9fffA-Za-z0-9（）()·*\s.-]{2,80}$/.test(query)) return null
    const filter = /^\d{6}$/.test(query) ? `(SECURITY_CODE="${query}")` : validCreditCode(query) ? `(REG_NUM="${query}")` : `(ORG_NAME="${query}")`
    const url = new URL('https://datacenter.eastmoney.com/securities/api/data/get')
    url.search = new URLSearchParams({ type: 'RPT_F10_ORG_BASICINFO', sty: 'ALL', filter, source: 'HSF10', client: 'PC' }).toString()
    try {
      const data = await getJson(url) as { result?: { data?: Record<string, unknown>[] } }
      const row = data.result?.data?.[0]
      if (!row || typeof row.ORG_NAME !== 'string' || typeof row.SECURITY_CODE !== 'string' || !/^\d{6}$/.test(row.SECURITY_CODE) || !/\.(SH|SZ)$/.test(String(row.STR_CODEA))) return null
      if (!/^\d{6}$/.test(query) && (validCreditCode(query) ? row.REG_NUM !== query : normalizeName(row.ORG_NAME) !== normalizeName(query))) return null
      return {
        id: row.SECURITY_CODE, name: String(row.SECURITY_NAME_ABBR), fullName: row.ORG_NAME,
        stockCode: String(row.STR_CODEA), creditCode: validCreditCode(String(row.REG_NUM)) ? String(row.REG_NUM) : undefined,
        identity: 'verified', listing: listingFromProfile(row), region: String(row.REG_ADDRESS ?? row.REGIONBK ?? ''),
        industry: String(row.BOARD_NAME_2LEVEL ?? row.CSRC_INDUSTRY_NAME ?? ''),
        sources: [{ title: '东方财富 · 企业基本资料', url: `https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/Index?type=web&code=${row.SECURITY_CODE.startsWith('6') ? 'sh' : 'sz'}${row.SECURITY_CODE}`, fetchedAt: new Date().toISOString(), kind: 'identity', state: 'ok', note: `主体：${row.ORG_NAME}` }],
      } satisfies CompanyIdentity
    } catch { return null }
  })()
  if (profiles.size >= 200) profiles.delete(profiles.keys().next().value!)
  profiles.set(query, { expires: Date.now() + 300_000, value })
  return value
}

/** Only the subject page may establish identity; parent and subsidiary facts stay separate. */
export function identityFromPage(company: CompanyIdentity, html: string): CompanyIdentity {
  const $ = load(html)
  $('script,style,nav,footer,header').remove()
  const name = normalizeName(company.fullName ?? company.name)
  const paragraphs = $('p,dd,td,li').toArray().map((node) => $(node).text().replace(/\s+/g, ' ').trim()).filter((text) => text.length < 600)
  const text = $('body').text().replace(/\s+/g, ' ')
  const subject = normalizeName($('title').text()).includes(name) || $('h1').toArray().some((node) => normalizeName($(node).text()) === name)
  if (!subject || !normalizeName(text).includes(name)) return company
  const codes = [...new Set([...text.matchAll(/统一社会信用代码\s*[：:]?\s*([0-9A-Z]{18})/g)].map((m) => m[1]))]
  const code = codes.length === 1 ? codes[0] : undefined
  const scoped = paragraphs.filter((line) => normalizeName(line).startsWith(name))
  const explicitlyUnlisted = scoped.some((line) => /(?:是一家|属于|为|：|:)\s*(?:非上市|未上市)|尚未上市|未在.{0,15}上市/.test(line))
  const explicitlyListed = scoped.some((line) => /(?:在|于).{0,25}(?:证券交易所|港交所|纽交所|纳斯达克).{0,12}上市/.test(line))
  return {
    ...company, identity: 'verified',
    creditCode: code && validCreditCode(code) ? code : company.creditCode,
    listing: explicitlyUnlisted ? 'unlisted' : explicitlyListed ? 'listed' : company.listing,
    region: text.match(/(?:注册地址|注册地位于)\s*[：:]?\s*([^。；;\n]{4,90})/)?.[1]?.trim() ?? company.region,
    industry: labeled(text, ['所属行业', '行业']) ?? company.industry,
    foundedAt: labeled(text, ['成立日期', '成立时间', '注册日期']) ?? company.foundedAt,
    registeredCapital: labeled(text, ['注册资本']) ?? company.registeredCapital,
    legalRepresentative: labeled(text, ['法定代表人', '法人代表']) ?? company.legalRepresentative,
    businessScope: labeled(text, ['经营范围']) ?? company.businessScope,
    description: paragraphs.find((line) => line.length >= 30 && /主营|业务|公司简介|成立/.test(line)) ?? company.description,
  }
}

export async function companyFromHit(hit: WebHit): Promise<CompanyIdentity | null> {
  const name = legalName(hit.title)
  if (!name) return null
  const listed = await listedProfile(name)
  if (listed) return listed
  const company: CompanyIdentity = {
    id: hitId(hit),
    name, fullName: name, listing: 'unknown', identity: 'lead',
    sources: [{ title: hit.title, url: hit.url, fetchedAt: new Date().toISOString(), kind: 'discovery', state: 'ok', note: '检索线索；摘要不作为财务或工商事实。' }],
  }
  let verified = company
  try {
    verified = identityFromPage(company, await fetchPublicPage(hit.url))
    verified.sources = [{ ...company.sources[0], kind: verified.identity === 'verified' ? 'identity' : 'discovery', note: verified.identity === 'verified' ? '页面主体名称已核对；工商登记与上市状态以明确披露为准。' : '已访问页面，未提取到足以确认主体的正文。' }]
  } catch (error) {
    verified.sources.push({ ...company.sources[0], kind: 'identity', state: error instanceof PublicWebError ? error.state : 'unavailable', note: error instanceof PublicWebError ? error.message : '来源超时或暂不可用；仅保留检索线索。' })
  }
  return verified
}

export async function discoverFromWeb(query: string, limit = 6): Promise<CompanySearchResult> {
  const result = await searchPublicDirectory(query)
  const hits = [...new Map(result.hits.filter((hit) => legalName(hit.title)).map((hit) => [hit.url, hit])).values()].slice(0, limit)
  const companies = await Promise.allSettled(hits.map(companyFromHit))
  return { suggestions: deduplicateCompanies(companies.flatMap((r) => r.status === 'fulfilled' && r.value ? [r.value] : [])), sources: result.sources }
}

export async function searchCompanies(query: string): Promise<CompanySearchResult> {
  const q = query.trim()
  if (q.length < 2 || q.length > 80) return { suggestions: [], sources: [] }
  const cache = searchCache.get(q)
  if (cache && cache.expires > Date.now()) return cache.value
  const value = (async () => {
    const [listed, exact, web, wikidata, neeq] = await Promise.allSettled([
      suggestCompanies(q, 5), listedProfile(q), /^\d{6}$/.test(q) ? Promise.resolve({ suggestions: [], sources: [] } as CompanySearchResult) : discoverFromWeb(q, 5),
      /^\d{6}$/.test(q) ? Promise.resolve({ suggestions: [], sources: [] } as CompanySearchResult) : searchWikidata(q),
      searchNeeq(q),
    ])
    const listedItems: CompanyIdentity[] = listed.status === 'fulfilled' ? await Promise.all(listed.value.map(async (c): Promise<CompanyIdentity> => await listedProfile(c.id) ?? ({ ...c, listing: 'unknown', identity: 'verified', sources: [{ title: '东方财富 · 证券主体检索', url: 'https://www.eastmoney.com/', fetchedAt: new Date().toISOString(), kind: 'identity', state: 'ok' }] }))) : []
    const exactItem = exact.status === 'fulfilled' ? exact.value : null
    const webResult = web.status === 'fulfilled' ? web.value : { suggestions: [], sources: [] }
    const wikiResult = wikidata.status === 'fulfilled' ? wikidata.value : { suggestions: [], sources: [] }
    const neeqResult = neeq.status === 'fulfilled' ? neeq.value : { suggestions: [], sources: [] }
    const results = deduplicateCompanies([...(exactItem ? [exactItem] : []), ...listedItems, ...neeqResult.suggestions, ...webResult.suggestions, ...wikiResult.suggestions])
    let suggestions = results.filter((c) => validCreditCode(q) ? c.creditCode === q : /^\d{6}$/.test(q) ? c.id === q || c.id === `neeq_${q}` : normalizeName(c.name).includes(normalizeName(q)) || normalizeName(c.fullName ?? '').includes(normalizeName(q))).slice(0, 8)
    // A live search must still be able to open a report for a company that is not
    // present in a directory. This is a lead only; no facts are inferred from the name.
    if (!suggestions.length && !/^\d{6}$/.test(q) && !validCreditCode(q) && /(?:股份有限公司|有限责任公司|有限公司)$/.test(q)) {
      const id = queryId(q)
      suggestions = [{ id, name: q, fullName: q, listing: 'unknown', identity: 'lead', sources: [{
        title: '国家企业信用信息公示系统 · 待人工核验', url: 'https://www.gsxt.gov.cn/index.html', fetchedAt: new Date().toISOString(), kind: 'identity', state: 'unavailable',
        note: '公开查询入口暂不允许本服务自动检索；请核对统一社会信用代码、注册地和主体页面。',
      }] }]
    }
    return { suggestions, sources: [...webResult.sources, ...wikiResult.sources, ...neeqResult.sources, { title: '上市主体检索', url: 'https://www.eastmoney.com/', fetchedAt: new Date().toISOString(), kind: 'discovery' as const, state: listed.status === 'fulfilled' ? 'ok' as const : 'unavailable' as const }] }
  })()
  if (searchCache.size >= 100) searchCache.delete(searchCache.keys().next().value!)
  searchCache.set(q, { expires: Date.now() + 60_000, value })
  return value
}
