import type { RawCompanyData } from '@/lib/types'

interface CacheEntry {
  data: RawCompanyData
  expiresAt: number
}

const TTL_MS = 5 * 60 * 1000
const store = new Map<string, CacheEntry>()

/** 进程内 TTL 缓存（MVP 足够；多实例部署需换外部缓存，见 DOC-A 扩展路线） */
export function cacheGet(id: string): RawCompanyData | null {
  const hit = store.get(id)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    store.delete(id)
    return null
  }
  return hit.data
}

export function cacheSet(id: string, data: RawCompanyData, ttlMs = TTL_MS): void {
  store.set(id, { data, expiresAt: Date.now() + ttlMs })
}
