import type { RawCompanyData, RegistryInfo } from '@/lib/types'
import type { DataAdapter } from '../adapter'
import { finite, getJson, sourceDate } from '../eastmoney'

type Row = Record<string, unknown>

function sourceUrl(companyId: string): string {
  const market = companyId.startsWith('6') ? 'sh' : /^[489]/.test(companyId) ? 'bj' : 'sz'
  return `https://f10.eastmoney.com/f10_v2/CompanySurvey.aspx?code=${market}${companyId}`
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || null
}

/** 将东方财富 F10 公司资料映射为严格可追溯的工商/简介切片。 */
export function registryFromProfile(row: Row, companyId: string): RegistryInfo | null {
  const fullName = text(row.ORG_NAME)
  const creditCode = text(row.REG_NUM)
  const foundedAt = sourceDate(row.FOUND_DATE)
  const registeredCapital = finite(row.REG_CAPITAL)
  if (!fullName || !creditCode || !foundedAt || registeredCapital === null || registeredCapital < 0) return null

  const profile = text(row.ORG_PROFILE)
  const mainBusiness = text(row.MAIN_BUSINESS)
  return {
    fullName,
    creditCode,
    foundedAt,
    registeredCapital: Math.round(registeredCapital * 100) / 100,
    ...(profile ? { profile } : {}),
    ...(mainBusiness ? { mainBusiness } : {}),
    sourceUrl: sourceUrl(companyId),
  }
}

/** 东方财富 F10 公司概况，包含企业基本登记资料及上市公司自行披露的简介。 */
export const profileAdapter: DataAdapter = {
  name: 'eastmoney_profile',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      if (!/^\d{6}$/.test(companyId)) return null
      const suffix = companyId.startsWith('6') ? 'SH' : /^[489]/.test(companyId) ? 'BJ' : 'SZ'
      const url = new URL('https://datacenter.eastmoney.com/securities/api/data/v1/get')
      url.search = new URLSearchParams({
        reportName: 'RPT_F10_BASIC_ORGINFO', columns: 'ALL',
        filter: `(SECUCODE="${companyId}.${suffix}")`,
        pageNumber: '1', pageSize: '1', source: 'HSF10', client: 'PC',
      }).toString()
      const json = await getJson(url) as { success?: boolean; result?: { data?: unknown } }
      const rows = json.result?.data
      const first = Array.isArray(rows) ? rows[0] as Row : null
      if (json.success !== true || !first) return null
      const registry = registryFromProfile(first, companyId)
      if (!registry) return null
      const industry = text(first.BOARD_NAME_LEVEL) ?? text(first.INDUSTRYCSRC1) ?? '未知行业'
      return {
        meta: {
          id: companyId,
          name: text(first.SECURITY_NAME_ABBR) ?? registry.fullName,
          stockCode: `${companyId}.${suffix}`,
          industry,
          fetchedAt: new Date().toISOString(),
          sources: [],
          registry,
        },
      }
    } catch {
      return null
    }
  },
}
