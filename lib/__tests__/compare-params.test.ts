// lib/__tests__/compare-params.test.ts
import { describe, expect, it } from 'vitest'
import { parseCompareParams } from '@/lib/compare-params'

describe('parseCompareParams URL 参数校验', () => {
  it('两家均为合法 A 股代码 → 通过', () =>
    expect(parseCompareParams({ a: '600519', b: '000858' })).toEqual({ a: '600519', b: '000858' }))
  it('相同公司 → null', () =>
    expect(parseCompareParams({ a: '600519', b: '600519' })).toBeNull())
  it('非 6 位代码（含旧 mock id）→ null', () =>
    expect(parseCompareParams({ a: '600519', b: 'mock-danger' })).toBeNull())
  it('缺失一个参数 → null', () =>
    expect(parseCompareParams({ a: '600519' })).toBeNull())
  it('空对象 / null → null', () => {
    expect(parseCompareParams({})).toBeNull()
    expect(parseCompareParams(null)).toBeNull()
    expect(parseCompareParams(undefined)).toBeNull()
  })
})
