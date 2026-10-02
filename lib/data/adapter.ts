import type { DataSourceName, RawCompanyData } from '@/lib/types'

/**
 * 数据适配器统一签名：输入公司 ID，输出 RawCompanyData 的局部切片。
 * 返回 null 表示该来源不可用（无 key / 超时 / 解析失败），fetcher 会如实标记该来源失败。
 * 实现要求：内部必须 try/catch 全包裹，绝不允许把异常抛给调用方。
 */
export interface DataAdapter {
  name: Exclude<DataSourceName, 'mock'>
  fetch(companyId: string): Promise<Partial<RawCompanyData> | null>
}
