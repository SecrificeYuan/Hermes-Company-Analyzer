import type { RawCompanyData, Shareholder } from '@/lib/types'
import type { DataAdapter } from '../adapter'
import { finite, getJson, sourceDate } from '../eastmoney'

type Row = Record<string, unknown>

/**
 * 十大股东适配器（东方财富 F10 股东持股，即 akshare 股东分析类接口的底层来源）。
 * 取最近一个报告期的前十大股东，映射为 shareholders 切片（比例降序）。
 */
export const holdersAdapter: DataAdapter = {
  name: 'eastmoney_holders',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      if (!/^\d{6}$/.test(companyId)) return null
      const suffix = companyId.startsWith('6') ? 'SH' : /^[489]/.test(companyId) ? 'BJ' : 'SZ'
      const url = new URL('https://datacenter.eastmoney.com/securities/api/data/v1/get')
      url.search = new URLSearchParams({
        reportName: 'RPT_F10_EH_HOLDERS', columns: 'ALL',
        filter: `(SECUCODE="${companyId}.${suffix}")`,
        pageNumber: '1', pageSize: '50',
        sortColumns: 'END_DATE,HOLDER_RANK', sortTypes: '-1,1',
        source: 'HSF10', client: 'PC',
      }).toString()
      const json = await getJson(url) as { result?: { data?: unknown } }
      const rows = json.result?.data
      if (!Array.isArray(rows) || rows.length === 0) return null

      // 只取最近报告期
      const dated = rows.map((row) => ({ row: row as Row, end: sourceDate((row as Row).END_DATE) }))
        .filter((item): item is { row: Row; end: string } => item.end !== null)
      if (!dated.length) return null
      const latestEnd = dated.map((item) => item.end).sort().at(-1)!

      const shareholders: Shareholder[] = []
      for (const { row } of dated.filter((item) => item.end === latestEnd)) {
        const name = typeof row.HOLDER_NAME === 'string' ? row.HOLDER_NAME.trim() : ''
        const ratio = finite(row.HOLD_NUM_RATIO)
        if (!name || ratio === null || ratio < 0 || ratio > 100) continue
        shareholders.push({
          name,
          ratio: Math.round(ratio * 100) / 100,
          isInstitution: String(row.IS_HOLDORG) === '1',
          date: latestEnd,
        })
      }
      shareholders.sort((a, b) => b.ratio - a.ratio)

      return shareholders.length ? { shareholders } : null
    } catch {
      return null
    }
  },
}
