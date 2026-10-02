import type { Announcement, RawCompanyData } from '@/lib/types'
import type { DataAdapter } from '../adapter'

/** 公告标题关键词 → 类型分类 */
function classify(title: string): Announcement['type'] {
  if (/减持/.test(title)) return '减持'
  if (/质押/.test(title)) return '质押'
  if (/诉讼|仲裁|执行/.test(title)) return '诉讼'
  if (/问询|关注函|监管函/.test(title)) return '问询'
  if (/年度报告|年报|半年度报告/.test(title)) return '年报'
  return '其他'
}

/**
 * 巨潮资讯公告适配器。
 * 通过 .env 中 CNINFO_ENABLED=true 启用；未启用时返回 null 触发降级。
 *
 * TODO(feat/data-engine)：接入巨潮公告查询接口
 *   POST http://www.cninfo.com.cn/new/hisAnnouncement/query
 *   按公司代码分页拉取，用 classify() 做标题分类，注意限流与 UA 伪装。
 */
export const cninfoAdapter: DataAdapter = {
  name: 'cninfo',
  async fetch(_companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      if (process.env.CNINFO_ENABLED !== 'true') return null
      // TODO: 实现真实抓取，返回 { announcements: [...] }
      return null
    } catch {
      return null
    }
  },
}
