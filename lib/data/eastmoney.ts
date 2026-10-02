const SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get'
const SEARCH_TOKEN = 'D43BF722C8E33BDC906FB84D85E326E8'

export interface ListedCompany {
  id: string
  name: string
  stockCode: string
}

export class CompanyLookupUnavailableError extends Error {
  constructor() {
    super('COMPANY_LOOKUP_UNAVAILABLE')
    this.name = 'CompanyLookupUnavailableError'
  }
}

export async function getJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 Hermes-Company-Analyzer/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Source returned ${response.status}`)
  return response.json()
}

export async function resolveCompany(input: string): Promise<ListedCompany | null> {
  const query = input.trim()
  if (!query || query.length > 40 || /[()"'\\]/.test(query)) return null
  try {
    const url = new URL(SEARCH_URL)
    url.search = new URLSearchParams({ input: query, type: '14', token: SEARCH_TOKEN }).toString()
    const json = await getJson(url) as { QuotationCodeTable?: { Data?: unknown[] } }
    const matches = json.QuotationCodeTable?.Data
    if (!Array.isArray(matches)) return null
    const match = matches.find((item) => {
      const row = item as Record<string, unknown>
      return row.Classify === 'AStock' && /^\d{6}$/.test(String(row.Code)) &&
        (row.Code === query || row.Name === query)
    }) as Record<string, unknown> | undefined
    if (!match) return null
    return toListedCompany(match)
  } catch {
    throw new CompanyLookupUnavailableError()
  }
}

/** 搜索候选：返回前 limit 个 A 股候选（供首页搜索下拉框） */
export async function suggestCompanies(input: string, limit = 6): Promise<ListedCompany[]> {
  const query = input.trim()
  if (!query || query.length > 40 || /[()"'\\]/.test(query)) return []
  try {
    const url = new URL(SEARCH_URL)
    // count 不传时接口只回 1 条候选；多要一些再过滤板块等非 A 股条目
    url.search = new URLSearchParams({ input: query, type: '14', token: SEARCH_TOKEN, count: String(limit * 3) }).toString()
    const json = await getJson(url) as { QuotationCodeTable?: { Data?: unknown[] } }
    const matches = json.QuotationCodeTable?.Data
    if (!Array.isArray(matches)) return []
    const companies: ListedCompany[] = []
    for (const item of matches) {
      const company = toListedCompany(item as Record<string, unknown>)
      if (company) companies.push(company)
      if (companies.length >= limit) break
    }
    return companies
  } catch {
    throw new CompanyLookupUnavailableError()
  }
}

function toListedCompany(row: Record<string, unknown>): ListedCompany | null {
  if (row.Classify !== 'AStock' || !/^\d{6}$/.test(String(row.Code))) return null
  const suffix = String(row.MktNum) === '1' ? 'SH' : String(row.MktNum) === '0' ? 'SZ' : null
  if (!suffix || typeof row.Name !== 'string') return null
  return { id: String(row.Code), name: row.Name, stockCode: `${String(row.Code)}.${suffix}` }
}

export function sourceDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}

export function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
