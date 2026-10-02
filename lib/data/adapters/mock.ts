import type { RawCompanyData } from '@/lib/types'
import healthy from '@/data/mock/company-healthy.json'
import warning from '@/data/mock/company-warning.json'
import danger from '@/data/mock/company-danger.json'

/**
 * Mock 兜底适配器：离线演示的生命线。
 * 三份 mock 覆盖 green / yellow / red 三种结论，断网也能完整演示。
 */
const MOCK_REGISTRY: Record<string, RawCompanyData> = {
  'mock-healthy': healthy as unknown as RawCompanyData,
  'mock-warning': warning as unknown as RawCompanyData,
  'mock-danger': danger as unknown as RawCompanyData,
}

export const MOCK_IDS = Object.keys(MOCK_REGISTRY)

export function isMockCompany(id: string): boolean {
  return id in MOCK_REGISTRY
}

export async function fetchMockCompany(id: string): Promise<RawCompanyData | null> {
  try {
    const data = Object.hasOwn(MOCK_REGISTRY, id) ? MOCK_REGISTRY[id] : null
    if (!data) return null
    // 深拷贝，防止下游 normalize 原地修改污染模块缓存
    return JSON.parse(JSON.stringify(data))
  } catch {
    return null
  }
}
