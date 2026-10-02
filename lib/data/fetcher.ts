import type { DataSourceStatus, RawCompanyData } from '@/lib/types'
import type { DataAdapter } from './adapter'
import { financialAdapter } from './adapters/financial'
import { announcementAdapter } from './adapters/cninfo'
import { pledgeAdapter } from './adapters/pledge'
import { holdersAdapter } from './adapters/holders'
import { profileAdapter } from './adapters/profile'
import { resolveCompany } from './eastmoney'
import { cacheGet, cacheSet } from './cache'

// 舆情走独立的客户端异步接口。不能让新闻源的限流或慢响应阻塞报告主体。
const ADAPTERS: DataAdapter[] = [financialAdapter, profileAdapter, announcementAdapter, pledgeAdapter, holdersAdapter]

/** 单个主体数据源的总时限，超时不拖住报告首屏。 */
const ADAPTER_DEADLINE_MS = 6000

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ADAPTER_TIMEOUT')), ms)),
  ])
}

export class CompanyNotFoundError extends Error {
  constructor(id: string) {
    super(`COMPANY_NOT_FOUND: ${id}`)
    this.name = 'CompanyNotFoundError'
  }
}

export class NoVerifiedDataError extends Error {
  constructor(id: string) {
    super(`NO_VERIFIED_DATA: ${id}`)
    this.name = 'NoVerifiedDataError'
  }
}

function normalize(data: RawCompanyData): RawCompanyData {
  data.financial?.years.sort((a, b) => a.year.localeCompare(b.year))
  if (data.announcements) {
    const seen = new Set<string>()
    data.announcements = data.announcements.filter((item) => {
      const key = `${item.date}|${item.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => b.date.localeCompare(a.date))
  }
  data.sentiment?.sort((a, b) => a.date.localeCompare(b.date))
  return data
}

/** Returns only verified live slices. A failed source never becomes a zero-valued record. */
export async function fetchRawCompany(input: string): Promise<RawCompanyData> {
  const company = await resolveCompany(input)
  if (!company) throw new CompanyNotFoundError(input)
  const cached = cacheGet(company.id)
  if (cached) return cached

  const settled = await Promise.allSettled(ADAPTERS.map(async (adapter) => {
    const started = Date.now()
    const data = await withDeadline(adapter.fetch(company.id), ADAPTER_DEADLINE_MS)
    return { data, latencyMs: Date.now() - started }
  }))

  const merged: RawCompanyData = {
    meta: {
      id: company.id, name: company.name, stockCode: company.stockCode,
      industry: '未知行业', fetchedAt: new Date().toISOString(), sources: [],
    },
  }
  const statuses: DataSourceStatus[] = []
  let hasData = false
  for (const [index, result] of settled.entries()) {
    const name = ADAPTERS[index].name
    const data = result.status === 'fulfilled' ? result.value.data : null
    const ok = Boolean(data && (data.meta?.registry || data.financial || data.announcements || data.legal || data.sentiment || data.people || data.shareholders))
    statuses.push({ name, ok, fallback: false, latencyMs: result.status === 'fulfilled' ? result.value.latencyMs : 0 })
    if (!ok || !data) continue
    hasData = true
    if (data.meta?.industry) merged.meta.industry = data.meta.industry
    if (data.meta?.registry) merged.meta.registry = data.meta.registry
    if (data.financial) merged.financial = data.financial
    if (data.announcements) merged.announcements = data.announcements
    if (data.legal) merged.legal = data.legal
    if (data.sentiment) merged.sentiment = data.sentiment
    if (data.people) merged.people = [...(merged.people ?? []), ...data.people]
    if (data.shareholders) merged.shareholders = data.shareholders
  }
  if (!hasData) throw new NoVerifiedDataError(company.id)
  merged.meta.sources = statuses
  const normalized = normalize(merged)
  cacheSet(company.id, normalized)
  return normalized
}
