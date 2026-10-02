export interface SearchRecord {
  id: string
  name: string
  stockCode?: string
  creditCode?: string
  at: number
}

const STORAGE_KEY = 'hermes-search-history'
const MAX_RECORDS = 3

function isRecord(value: unknown): value is SearchRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return typeof r.id === 'string' && typeof r.name === 'string' &&
    (r.stockCode === undefined || typeof r.stockCode === 'string') &&
    (r.creditCode === undefined || typeof r.creditCode === 'string') && typeof r.at === 'number'
}

/** 读取最近搜索记录（新→旧）；SSR 或数据损坏时返回空数组 */
export function getSearchHistory(): SearchRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecord).slice(0, MAX_RECORDS)
  } catch {
    return []
  }
}

/** 追加一条记录：按 id 去重、新记录置顶、最多保留 3 条；返回更新后的列表 */
export function addSearchHistory(company: Omit<SearchRecord, 'at'>): SearchRecord[] {
  const record: SearchRecord = { id: company.id, name: company.name, stockCode: company.stockCode, creditCode: company.creditCode, at: Date.now() }
  const rest = getSearchHistory().filter((r) => r.id !== record.id)
  const next = [record, ...rest].slice(0, MAX_RECORDS)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 隐私模式等写入失败：仅内存返回，不抛错
    }
  }
  return next
}
