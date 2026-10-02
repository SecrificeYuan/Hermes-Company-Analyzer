import type { Announcement, RawCompanyData } from '@/lib/types'
import type { DataAdapter } from '../adapter'
import { getJson, sourceDate } from '../eastmoney'

/**
 * 仅把指向司法程序的明确措辞标为“诉讼”。
 * “执行情况”“执行报告”等经营披露中的“执行”不代表被执行或诉讼。
 */
export function classifyAnnouncement(title: string): Announcement['type'] {
  if (/减持/.test(title)) return '减持'
  if (/质押/.test(title)) return '质押'
  if (/诉讼|仲裁|被执行|强制执行|执行裁定|执行通知|执行申请/.test(title)) return '诉讼'
  if (/问询|关注函|监管函/.test(title)) return '问询'
  if (/年度报告|年报|半年度报告/.test(title)) return '年报'
  return '其他'
}

export const announcementAdapter: DataAdapter = {
  name: 'eastmoney_announcements',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      if (!/^\d{6}$/.test(companyId)) return null
      const url = new URL('https://np-anotice-stock.eastmoney.com/api/security/ann')
      url.search = new URLSearchParams({
        sr: '-1', page_size: '100', page_index: '1', ann_type: 'A',
        client_source: 'web', stock_list: companyId,
      }).toString()
      const json = await getJson(url) as { success?: number; data?: { list?: unknown[] } }
      if (json.success !== 1 || !Array.isArray(json.data?.list)) return null
      const announcements: Announcement[] = []
      for (const item of json.data.list) {
        const row = item as Record<string, unknown>
        const codes = row.codes
        if (!Array.isArray(codes) || !codes.some((code) => (code as Record<string, unknown>).stock_code === companyId)) continue
        const date = sourceDate(row.notice_date)
        const title = typeof row.title === 'string' ? row.title.trim() : ''
        const artCode = typeof row.art_code === 'string' ? row.art_code : ''
        if (!date || !title || !/^AN\d+$/.test(artCode)) continue
        announcements.push({
          date, title, type: classifyAnnouncement(title),
          url: `https://data.eastmoney.com/notices/detail/${companyId}/${artCode}.html`,
        })
      }
      return announcements.length ? { announcements } : null
    } catch {
      return null
    }
  },
}
