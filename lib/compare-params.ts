// lib/compare-params.ts
export interface CompareSelection {
  a?: string
  b?: string
}

// 允许 6 位代码或带交易所后缀的完整代码（300024 / 300024.SZ 均可）
const A_STOCK_CODE = /^\d{6}(?:\.(?:SZ|SH|BJ|SS))?$/i
const digits = (code: string) => code.slice(0, 6)

/** 校验 URL 对比参数：每个给出的代码须为 6 位 A 股代码（可带 .SZ/.SH/.BJ 后缀），两码互异；
 *  双码齐全供自动开战，单码只回填该槽位，无码返回 null */
export function parseCompareParams(params: { a?: string; b?: string } | null | undefined): CompareSelection | null {
  const a = params?.a?.trim()
  const b = params?.b?.trim()
  if (a && !A_STOCK_CODE.test(a)) return null
  if (b && !A_STOCK_CODE.test(b)) return null
  if (a && b && digits(a) === digits(b)) return null
  if (!a && !b) return null
  return { a, b }
}
