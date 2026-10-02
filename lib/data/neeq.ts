import type { Announcement, FinancialYear } from '@/lib/types'
import type { CompanyIdentity, CompanySearchResult, PublicSource } from '@/lib/company'

const BASE = 'https://www.neeq.com.cn'
const SEARCH = `${BASE}/disclosureInfoController/companyAnnouncement.do`
const REFERER = `${BASE}/m/disclosure/announcement.html`
const MAX_PDF_BYTES = 12_000_000
const cache = new Map<string, { expires: number; value: Promise<NeeqReport> }>()

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  // The package entrypoint runs its test fixture when bundled by Next.js.
  // Load the parser implementation directly so a search request cannot fail
  // during module initialization.
  const parserModule = await import('pdf-parse/lib/pdf-parse.js') as unknown as { default?: (data: Buffer) => Promise<{ text: string }>; }
  const parser = parserModule.default ?? (parserModule as unknown as ((data: Buffer) => Promise<{ text: string }>))
  return parser(buffer)
}

type Row = Record<string, unknown>
export type NeeqFiling = { code: string; name: string; title: string; date: string; year: string; url: string }
export type NeeqReport = { company: CompanyIdentity; filings: NeeqFiling[]; years: FinancialYear[]; announcements: Announcement[]; sources: PublicSource[] }

export function parseNeeqResponse(text: string): { rows: Row[]; totalPages: number } {
  const trimmed = text.trim()
  const json = trimmed.startsWith('null(') && trimmed.endsWith(')') ? trimmed.slice(5, -1) : trimmed
  const value = JSON.parse(json) as unknown
  const info = Array.isArray(value) && value[0] && typeof value[0] === 'object' ? (value[0] as Row).listInfo as Row | undefined : undefined
  if (!info || !Array.isArray(info.content)) throw new Error('全国股转系统公告响应格式已变化')
  return { rows: info.content as Row[], totalPages: Number(info.totalPages) || 0 }
}

export function filingFromRow(row: Row): NeeqFiling | null {
  const code = String(row.companyCd ?? '')
  const name = String(row.companyName ?? '').trim()
  const title = String(row.disclosureTitle ?? '') + String(row.disclosurePostTitle ?? '')
  const date = String(row.publishDate ?? '').slice(0, 10)
  const file = String(row.destFilePath ?? '')
  const year = title.match(/(20\d{2})年年度报告/)?.[1]
  if (!/^\d{6}$/.test(code) || !name || !year || !/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
    !/^\/disclosure\/[\w/.-]+\.pdf$/i.test(file) || !/^pdf$/i.test(String(row.fileExt ?? '')) ||
    /摘要|已取消|半年度|更正公告/.test(title)) return null
  return { code, name, title, date, year, url: `${BASE}${file}` }
}

function source(title: string, url: string, kind: PublicSource['kind'], state: PublicSource['state'], note: string): PublicSource {
  return { title, url, kind, state, fetchedAt: new Date().toISOString(), note }
}

async function filingsPage(input: { keyword?: string; code?: string; start: string; end: string; page: number }): Promise<{ filings: NeeqFiling[]; totalPages: number }> {
  const body = new URLSearchParams({
    page: String(input.page), companyCd: input.code ?? '', isNewThree: '1', startTime: input.start,
    endTime: input.end, keyword: input.keyword ?? '',
  })
  body.append('xxfcbj[]', '3')
  body.append('disclosureSubtype[]', '9503-1001')
  for (const field of ['companyCd', 'companyName', 'disclosureTitle', 'disclosurePostTitle', 'destFilePath', 'publishDate', 'fileExt']) body.append('needFields[]', field)
  const response = await fetch(SEARCH, {
    method: 'POST', body,
    headers: { Accept: 'application/json,text/javascript,*/*', Referer: REFERER, 'X-Requested-With': 'XMLHttpRequest' },
    signal: AbortSignal.timeout(12000), cache: 'no-store',
  })
  if (!response.ok) throw new Error(`全国股转系统返回 ${response.status}`)
  const parsed = parseNeeqResponse(await response.text())
  return { filings: parsed.rows.flatMap((row) => filingFromRow(row) ?? []), totalPages: parsed.totalPages }
}

function dateWindow(): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  const start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)).toISOString().slice(0, 10)
  return { start, end }
}

function companyFromFiling(filing: NeeqFiling): CompanyIdentity {
  return {
    id: `neeq_${filing.code}`, name: filing.name, listing: 'unlisted', identity: 'verified',
    sources: [source('全国股转系统 · 挂牌公司年度报告', filing.url, 'identity', 'ok', `证券简称：${filing.name}；挂牌代码：${filing.code}。挂牌不等于交易所上市，工商全称以报告正文为准。`)],
  }
}

export async function searchNeeq(keyword: string, maxPages = 1): Promise<CompanySearchResult> {
  const q = keyword.trim()
  if (q.length > 60 || /[<>\x00-\x1f]/.test(q)) return { suggestions: [], sources: [] }
  const { start, end } = dateWindow()
  const discoverySource = source('全国股转系统 · 年报实时检索', REFERER, 'discovery', 'ok', '仅覆盖近两年有年度报告的挂牌企业；不是完整工商名录。')
  try {
    const first = await filingsPage({ ...(q ? /^\d{6}$/.test(q) ? { code: q } : { keyword: q } : {}), start, end, page: 0 })
    const all = [...first.filings]
    for (let page = 1; page < Math.min(maxPages, first.totalPages); page++) {
      const next = await filingsPage({ ...(q ? /^\d{6}$/.test(q) ? { code: q } : { keyword: q } : {}), start, end, page })
      all.push(...next.filings)
    }
    const matched = q && !/^\d{6}$/.test(q) ? all.filter((item) => item.name.includes(q) || item.title.includes(q)) : all
    const companies = [...new Map(matched.map((filing) => [filing.code, companyFromFiling(filing)])).values()]
    return { suggestions: companies.slice(0, 12), sources: [{ ...discoverySource, state: companies.length ? 'ok' : 'empty' }] }
  } catch (error) {
    return { suggestions: [], sources: [{ ...discoverySource, state: 'unavailable', note: error instanceof Error ? error.message : '年报检索暂不可用' }] }
  }
}

export async function findNeeqCompany(code: string): Promise<CompanyIdentity | null> {
  if (!/^\d{6}$/.test(code)) return null
  const found = await searchNeeq(code)
  return found.suggestions.find((item) => item.id === `neeq_${code}`) ?? null
}

function money(line: string): number[] {
  return [...line.matchAll(/(?<![\d,])[-−－]?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?(?!\d)|(?<![\d,])[-−－]?\d{4,}(?:\.\d{1,2})?(?!\d)/g)]
    .map((match) => Number(match[0].replace(/,/g, '').replace(/[−－]/g, '-')))
    .filter(Number.isFinite)
}

function section(text: string, title: string, next: string): string | null {
  const start = text.indexOf(title)
  if (start < 0) return null
  const end = text.indexOf(next, start + title.length)
  if (end < 0 || end - start > 40_000) return null
  return text.slice(start, end)
}

function rowValues(text: string, label: RegExp): number[] | null {
  for (const line of text.split(/\r?\n/)) {
    if (!label.test(line)) continue
    const values = money(line)
    if (values.length >= 2) return values.slice(-2)
  }
  return null
}

export function parseNeeqProfileText(text: string): Partial<CompanyIdentity> {
  const overview = text.slice(0, 12_000)
  const fullName = overview.match(/公司中文全称\s+([^\r\n]{4,80}(?:股份有限公司|有限责任公司|有限公司))/)?.[1]?.trim()
  const creditCode = overview.match(/统一社会信用代码\s+([0-9A-Z]{18})/)?.[1]
  const region = overview.match(/注册地址\s+([^\r\n]{4,100})/)?.[1]?.trim()
  const founded = overview.match(/成立时间\s+(20\d{2}|19\d{2})年(\d{1,2})月(\d{1,2})日/)
  const website = overview.match(/公司网址\s+(https:\/\/[^\s]+)/)?.[1]
  const business = overview.match(/主要产品与服务项目\s+([^\r\n]{4,150})/)?.[1]?.trim()
  const category = overview.match(/行业分类[）)]\s*\r?\n([^\r\n]{2,100})/)?.[1]?.trim()
  const capital = overview.match(/注册资本（元）\s+([\d,]+(?:\.\d{1,2})?)/)?.[1]
  return {
    ...(fullName ? { fullName } : {}), ...(creditCode ? { creditCode } : {}),
    ...(region ? { region } : {}), ...(website ? { website } : {}),
    ...(business ? { description: business } : {}),
    ...(category ? { industry: category.split(/[（(]/)[0].trim() } : {}),
    ...(capital ? { registeredCapital: `${Number(capital.replace(/,/g, '')) / 10000} 万元` } : {}),
    ...(founded ? { foundedAt: `${founded[1]}-${founded[2].padStart(2, '0')}-${founded[3].padStart(2, '0')}` } : {}),
  }
}

export function parseNeeqFinancialText(text: string, reportYear: string): { years: FinancialYear[]; fullName?: string } {
  const front = text.slice(0, 5000)
  const fullName = front.match(/([\u4e00-\u9fffA-Za-z0-9（）()·]{4,70}股份有限公司)/)?.[1]
  const balance = section(text, '合并资产负债表', '母公司资产负债表')
  const income = section(text, '合并利润表', '母公司利润表')
  const cash = section(text, '合并现金流量表', '母公司现金流量表')
  if (!balance || !income || !cash || !/单位\s*[：:]\s*元/.test(balance.slice(0, 130)) || !/单位\s*[：:]\s*元/.test(income.slice(0, 130)) || !/单位\s*[：:]\s*元/.test(cash.slice(0, 130))) return { years: [], fullName }
  const years = balance.slice(0, 150).match(/(20\d{2})年12月31日\s+(20\d{2})年12月31日/)
  if (!years || years[1] !== reportYear || Number(years[2]) !== Number(reportYear) - 1) return { years: [], fullName }
  const assets = rowValues(balance, /^\s*资产总计\s+/)
  const liabilities = rowValues(balance, /^\s*负债合计\s+/)
  const currentAssets = rowValues(balance, /^\s*流动资产合计\s+/)
  const currentLiabilities = rowValues(balance, /^\s*流动负债合计\s+/)
  const revenue = rowValues(income, /^\s*(?:其中[：:]\s*)?营业收入\s+/) ?? rowValues(income, /^\s*[一二]、营业总收入\s+/)
  const profit = rowValues(income, /^\s*[五六]、净利润[（(]/)
  const operatingCash = rowValues(cash, /^\s*经营活动产生的现金流量净额\s+/)
  if (!assets || !liabilities || !currentAssets || !currentLiabilities || !revenue || !profit || !operatingCash) return { years: [], fullName }
  const result: FinancialYear[] = []
  for (const index of [1, 0]) {
    const a = assets[index], l = liabilities[index], ca = currentAssets[index], cl = currentLiabilities[index]
    if (!(a > 0 && l >= 0 && ca >= 0 && cl >= 0 && revenue[index] >= 0) || l > a * 2 || ca > a * 1.01 || cl > l * 1.01) return { years: [], fullName }
    result.push({ year: years[index === 0 ? 1 : 2], revenue: revenue[index] / 10000, netProfit: profit[index] / 10000,
      operatingCashFlow: operatingCash[index] / 10000, debtRatio: l / a * 100,
      ...(cl > 0 ? { currentRatio: ca / cl } : {}),
    })
  }
  return { years: result, fullName }
}

async function fetchPdf(url: string): Promise<Buffer> {
  const parsed = new URL(url)
  if (parsed.origin !== BASE || !/^\/disclosure\/[\w/.-]+\.pdf$/i.test(parsed.pathname)) throw new Error('年报链接不属于全国股转系统')
  const response = await fetch(url, { headers: { Referer: REFERER, Accept: 'application/pdf' }, signal: AbortSignal.timeout(20000), cache: 'no-store' })
  if (!response.ok || !response.headers.get('content-type')?.includes('pdf')) throw new Error(`年报 PDF 返回 ${response.status}`)
  if (Number(response.headers.get('content-length') || 0) > MAX_PDF_BYTES) throw new Error('年报 PDF 超过解析大小限制')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > MAX_PDF_BYTES || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('年报 PDF 无效')
  return bytes
}

export async function getNeeqReport(code: string): Promise<NeeqReport> {
  if (!/^\d{6}$/.test(code)) throw new Error('无效挂牌代码')
  const cached = cache.get(code)
  if (cached && cached.expires > Date.now()) return cached.value
  const value = (async (): Promise<NeeqReport> => {
    const company = await findNeeqCompany(code)
    if (!company) throw new Error('未找到挂牌企业的近期年度报告')
    const { start, end } = dateWindow()
    const page = await filingsPage({ code, start, end, page: 0 })
    const filings = page.filings.filter((filing) => filing.code === code).sort((a, b) => b.year.localeCompare(a.year) || b.date.localeCompare(a.date))
    const announcements: Announcement[] = filings.map((filing) => ({ date: filing.date, title: filing.title, type: '年报', url: filing.url }))
    const selected = filings[0]
    const sources = [...company.sources]
    let years: FinancialYear[] = []
    if (selected) {
      try {
        const bytes = await fetchPdf(selected.url)
        const parsed = await parsePdf(bytes)
        if (!parsed.text || parsed.text.length < 1000) throw new Error('PDF 缺少可提取文字')
        Object.assign(company, parseNeeqProfileText(parsed.text))
        const result = parseNeeqFinancialText(parsed.text, selected.year)
        years = result.years
        sources.push(source('全国股转系统 · 合并财务报表', selected.url, 'financial', years.length ? 'ok' : 'unavailable', years.length ? `已从 ${selected.year} 年年报核对合并三表；金额单位转换为万元。` : '已读取年报，但合并三表或字段校验未通过；不生成财务指标。'))
      } catch (error) {
        sources.push(source('全国股转系统 · 合并财务报表', selected.url, 'financial', 'unavailable', error instanceof Error ? error.message : '年报解析暂不可用'))
      }
    }
    return { company, filings, years, announcements, sources }
  })()
  if (cache.size >= 100) cache.delete(cache.keys().next().value!)
  cache.set(code, { expires: Date.now() + 300_000, value })
  void value.catch(() => cache.delete(code))
  return value
}
