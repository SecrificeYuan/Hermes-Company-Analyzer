import type { FinancialYear, RawCompanyData } from '@/lib/types'
import type { DataAdapter } from '../adapter'
import { finite, getJson, sourceDate } from '../eastmoney'

type Row = Record<string, unknown>

function annual(rows: unknown): Map<string, Row> {
  const byYear = new Map<string, Row>()
  if (!Array.isArray(rows)) return byYear
  for (const item of rows) {
    const row = item as Row
    const date = sourceDate(row?.REPORT_DATE)
    if (date?.endsWith('-12-31')) byYear.set(date.slice(0, 4), row)
  }
  return byYear
}

export function financialYears(summaryRows: unknown, cashRows: unknown): FinancialYear[] {
  const summary = annual(summaryRows)
  const cash = annual(cashRows)
  const years: FinancialYear[] = []
  for (const year of [...summary.keys()].filter((key) => cash.has(key)).sort()) {
    const income = summary.get(year)!
    const flow = cash.get(year)!
    const revenue = finite(income.TOTALOPERATEREVE)
    const netProfit = finite(income.PARENTNETPROFIT)
    const operatingCashFlow = finite(flow.NETCASH_OPERATE)
    const debtRatio = finite(income.ZCFZL)
    const currentRatio = finite(income.LD)
    if (revenue === null || netProfit === null || operatingCashFlow === null || debtRatio === null || currentRatio === null) continue
    if (revenue < 0 || debtRatio < 0 || debtRatio > 100 || currentRatio < 0) continue
    years.push({
      year,
      revenue: Math.round(revenue / 100) / 100,
      netProfit: Math.round(netProfit / 100) / 100,
      operatingCashFlow: Math.round(operatingCashFlow / 100) / 100,
      debtRatio: Math.round(debtRatio * 100) / 100,
      currentRatio: Math.round(currentRatio * 100) / 100,
    })
  }
  return years.slice(-3)
}

export const financialAdapter: DataAdapter = {
  name: 'eastmoney_financial',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      if (!/^\d{6}$/.test(companyId)) return null
      const suffix = companyId.startsWith('6') ? 'SH' : 'SZ'
      const summaryUrl = new URL('https://datacenter.eastmoney.com/securities/api/data/get')
      summaryUrl.search = new URLSearchParams({
        type: 'RPT_F10_FINANCE_MAINFINADATA', sty: 'APP_F10_MAINFINADATA',
        filter: `(SECUCODE="${companyId}.${suffix}")`, p: '1', ps: '80', sr: '-1',
        st: 'REPORT_DATE', source: 'HSF10', client: 'PC',
      }).toString()
      const cashUrl = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get')
      cashUrl.search = new URLSearchParams({
        sortColumns: 'NOTICE_DATE', sortTypes: '-1', pageSize: '100', pageNumber: '1',
        reportName: 'RPT_DMSK_FN_CASHFLOW', columns: 'ALL',
        filter: `(SECURITY_CODE="${companyId}")`, source: 'WEB', client: 'WEB',
      }).toString()
      const [summary, cash] = await Promise.all([getJson(summaryUrl), getJson(cashUrl)]) as
        [{ result?: { data?: unknown } }, { result?: { data?: unknown } }]
      const years = financialYears(summary.result?.data, cash.result?.data)
      if (!years.length) return null
      const summaryRows = summary.result?.data
      const summaryFirst = Array.isArray(summaryRows) ? summaryRows[0] as Record<string, unknown> : null
      const name = typeof summaryFirst?.SECURITY_NAME_ABBR === 'string' ? summaryFirst.SECURITY_NAME_ABBR : ''
      if (!name) return null
      const cashRows = cash.result?.data
      const first = Array.isArray(cashRows) ? cashRows[0] as Record<string, unknown> : null
      const industry = typeof first?.INDUSTRY_NAME === 'string' ? first.INDUSTRY_NAME : '未知行业'
      return {
        meta: { id: companyId, name, stockCode: `${companyId}.${suffix}`, industry, fetchedAt: new Date().toISOString(), sources: [] },
        financial: { years },
      }
    } catch {
      return null
    }
  },
}
