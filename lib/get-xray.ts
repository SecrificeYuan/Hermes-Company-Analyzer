import { analyze } from '@/lib/analysis/analyze'
import { fetchRawCompany } from '@/lib/data/fetcher'
import type { CompanyXRay } from '@/lib/types'

const xrayCache = new Map<string, { data: CompanyXRay; expiresAt: number }>()
const TTL_MS = 5 * 60 * 1000

/**
 * 统一取数入口：API Route 与 Server Component 共用。
 * 前端 HTTP 消费走 /api/company/[id]/xray；页面服务端渲染直接调本函数，免去自请求。
 */
export async function getXRay(id: string): Promise<CompanyXRay> {
  const hit = xrayCache.get(id)
  if (hit && Date.now() < hit.expiresAt) return hit.data

  const raw = await fetchRawCompany(id)
  const xray = analyze(raw)
  xrayCache.set(id, { data: xray, expiresAt: Date.now() + TTL_MS })
  return xray
}
