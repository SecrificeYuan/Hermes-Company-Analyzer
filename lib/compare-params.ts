// lib/compare-params.ts
export interface CompareSelection {
  a: string
  b: string
}

const A_STOCK_CODE = /^\d{6}$/

/** 校验 URL 对比参数：两家均为 6 位 A 股代码且互异，否则返回 null（页面回初始态） */
export function parseCompareParams(params: { a?: string; b?: string } | null | undefined): CompareSelection | null {
  const a = params?.a
  const b = params?.b
  if (!a || !b || a === b) return null
  return A_STOCK_CODE.test(a) && A_STOCK_CODE.test(b) ? { a, b } : null
}
