import type { RawCompanyData } from '@/lib/types'
import type { DataAdapter } from '../adapter'
import { finite, getJson, sourceDate } from '../eastmoney'

type Row = Record<string, unknown>

/**
 * 股权质押适配器（东方财富数据中心 RPT_CSDC_LIST，与中登公司质押比例同源，
 * 即 akshare stock_pledge_ratio 的底层接口）。
 *
 * 映射为 people 事件：event='质押' 时 amount 约定为累计质押比例（0-100 的百分数），
 * defense 评分取最大值。PLEDGE_RATIO 本身即百分数，直接采用。
 */
export const pledgeAdapter: DataAdapter = {
  name: 'eastmoney_pledge',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      if (!/^\d{6}$/.test(companyId)) return null
      const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get')
      url.search = new URLSearchParams({
        reportName: 'RPT_CSDC_LIST', columns: 'ALL',
        filter: `(SECURITY_CODE="${companyId}")`,
        pageNumber: '1', pageSize: '10',
        sortColumns: 'TRADE_DATE', sortTypes: '-1',
        source: 'WEB', client: 'WEB',
      }).toString()
      const json = await getJson(url) as { result?: { data?: unknown } }
      const rows = json.result?.data
      if (!Array.isArray(rows)) return null
      const latest = rows.find((row): row is Row => {
        const ratio = finite((row as Row)?.PLEDGE_RATIO)
        return ratio !== null && ratio >= 0 && ratio <= 100
      })
      if (!latest) return null
      const date = sourceDate(latest.TRADE_DATE)
      if (!date) return null
      const ratio = finite(latest.PLEDGE_RATIO)!
      return {
        people: [{
          name: '股东整体质押',
          role: '股东',
          event: '质押',
          date,
          amount: Math.round(ratio * 100) / 100,
        }],
      }
    } catch {
      return null
    }
  },
}
