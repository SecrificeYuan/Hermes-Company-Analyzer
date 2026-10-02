// lib/compare-params.ts
import { PRESET_COMPANIES } from './presets'

export interface CompareSelection {
  a: string
  b: string
}

/** 校验 URL 对比参数：两家都须为预设公司且互异，否则返回 null（页面回初始态） */
export function parseCompareParams(params: { a?: string; b?: string } | null | undefined): CompareSelection | null {
  const a = params?.a
  const b = params?.b
  if (!a || !b || a === b) return null
  const ids = new Set(PRESET_COMPANIES.map((c) => c.id))
  return ids.has(a) && ids.has(b) ? { a, b } : null
}
