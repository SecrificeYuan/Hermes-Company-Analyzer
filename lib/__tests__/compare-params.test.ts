// lib/__tests__/compare-params.test.ts
import { describe, expect, it } from 'vitest'
import { parseCompareParams } from '@/lib/compare-params'

describe('parseCompareParams URL 参数校验', () => {
  it('两家均为合法预设 → 通过', () =>
    expect(parseCompareParams({ a: 'mock-healthy', b: 'mock-danger' })).toEqual({ a: 'mock-healthy', b: 'mock-danger' }))
  it('相同公司 → null', () =>
    expect(parseCompareParams({ a: 'mock-healthy', b: 'mock-healthy' })).toBeNull())
  it('未知 id → null', () =>
    expect(parseCompareParams({ a: 'mock-healthy', b: 'nope' })).toBeNull())
  it('缺失一个参数 → null', () =>
    expect(parseCompareParams({ a: 'mock-healthy' })).toBeNull())
  it('空对象 / null → null', () => {
    expect(parseCompareParams({})).toBeNull()
    expect(parseCompareParams(null)).toBeNull()
    expect(parseCompareParams(undefined)).toBeNull()
  })
})
