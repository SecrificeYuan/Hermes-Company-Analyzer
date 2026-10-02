import type { RawCompanyData } from '@/lib/types'
import type { DataAdapter } from '../adapter'

/**
 * 聚合数据涉诉适配器。
 * 在 https://www.juhe.cn 免费注册 key，写入 .env 的 JUHE_API_KEY 后启用。
 *
 * TODO(feat/data-engine)：调用聚合「企业涉诉」类接口，把返回映射为
 *   legal: { lawsuits, executions, dishonest }
 *   注意：金额统一换算成万元，日期统一 ISO，失败一律返回 null。
 */
export const juheAdapter: DataAdapter = {
  name: 'juhe',
  async fetch(_companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      const key = process.env.JUHE_API_KEY
      if (!key) return null
      // TODO: 实现真实查询
      return null
    } catch {
      return null
    }
  },
}
