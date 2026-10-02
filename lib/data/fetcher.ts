import type { DataSourceStatus, RawCompanyData } from '@/lib/types'
import type { DataAdapter } from './adapter'
import { akshareAdapter } from './adapters/akshare'
import { cninfoAdapter } from './adapters/cninfo'
import { juheAdapter } from './adapters/juhe'
import { gdeltAdapter } from './adapters/gdelt'
import { fetchMockCompany } from './adapters/mock'
import { cacheGet, cacheSet } from './cache'

const REAL_ADAPTERS: DataAdapter[] = [akshareAdapter, cninfoAdapter, juheAdapter, gdeltAdapter]

export class CompanyNotFoundError extends Error {
  constructor(id: string) {
    super(`COMPANY_NOT_FOUND: ${id}`)
    this.name = 'CompanyNotFoundError'
  }
}

/** 数据清洗：日期 ISO、金额万元、去重、排序（years/sentiment 升序，公告/诉讼倒序） */
function normalize(data: RawCompanyData): RawCompanyData {
  if (data.financial?.years) {
    const seen = new Set<string>()
    data.financial.years = data.financial.years
      .filter((y) => (seen.has(y.year) ? false : (seen.add(y.year), true)))
      .sort((a, b) => a.year.localeCompare(b.year))
  }
  if (data.announcements) {
    const seen = new Set<string>()
    data.announcements = data.announcements
      .filter((a) => {
        const key = `${a.date}|${a.title}`
        return seen.has(key) ? false : (seen.add(key), true)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }
  if (data.legal?.lawsuits) {
    data.legal.lawsuits.sort((a, b) => b.date.localeCompare(a.date))
  }
  if (data.sentiment) {
    data.sentiment.sort((a, b) => a.date.localeCompare(b.date))
  }
  return data
}

/**
 * 统一调度入口：并行调用所有真实 adapter，任一失败则对应切片降级到 mock，
 * 并在 meta.sources 如实标记 fallback —— 前端据此展示数据来源角标。
 */
export async function fetchRawCompany(companyId: string): Promise<RawCompanyData> {
  const cached = cacheGet(companyId)
  if (cached) return cached

  const mockStarted = Date.now()
  const mockData = await fetchMockCompany(companyId)
  const mockStatus: DataSourceStatus = {
    name: 'mock',
    ok: mockData !== null,
    latencyMs: Date.now() - mockStarted,
    fallback: false, // mock 本身是兜底源，不算"被降级"
  }

  const settled = await Promise.allSettled(
    REAL_ADAPTERS.map(async (adapter) => {
      const started = Date.now()
      const data = await adapter.fetch(companyId)
      return { adapter, data, latencyMs: Date.now() - started }
    }),
  )

  // 以 mock（如有）为底，真实数据按切片覆盖
  const merged: RawCompanyData = mockData
    ? { ...mockData, meta: { ...mockData.meta, sources: [] } }
    : {
        meta: {
          id: companyId,
          name: companyId,
          industry: '未知行业',
          fetchedAt: new Date().toISOString(),
          sources: [],
        },
      }

  const statuses: DataSourceStatus[] = [mockStatus]
  let realSections = 0

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue // adapter 内部已兜底，理论上不会到这
    const { adapter, data, latencyMs } = result.value
    const ok = data !== null && Object.keys(data).length > 0
    statuses.push({ name: adapter.name, ok, latencyMs, fallback: !ok })
    if (!ok || !data) continue
    realSections++
    if (data.financial) merged.financial = data.financial
    if (data.announcements) merged.announcements = data.announcements
    if (data.legal) merged.legal = data.legal
    if (data.sentiment) merged.sentiment = data.sentiment
    if (data.people) merged.people = data.people
  }

  // 没有任何可用数据：mock 不存在且真实源全灭 → 明确 404，不编造公司
  if (!mockData && realSections === 0) {
    throw new CompanyNotFoundError(companyId)
  }

  merged.meta.sources = statuses
  const normalized = normalize(merged)
  cacheSet(companyId, normalized)
  return normalized
}
