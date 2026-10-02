// lib/__tests__/compare-verdict.test.ts
import { describe, expect, it } from 'vitest'
import { compareVerdict } from '@/lib/analysis/compare-verdict'

describe('compareVerdict 胜负判定', () => {
  it('A 风险分更低 → A 胜', () => expect(compareVerdict(28, 61)).toBe('A'))
  it('B 风险分更低 → B 胜', () => expect(compareVerdict(70, 40)).toBe('B'))
  it('分差 =3 → 平局（含等号）', () => expect(compareVerdict(10, 13)).toBe('draw'))
  it('分差 <3 → 平局', () => expect(compareVerdict(50, 52)).toBe('draw'))
  it('分差 >3 → 有胜负（边界外）', () => expect(compareVerdict(10, 14)).toBe('A'))
  it('极端分：0 vs 100', () => expect(compareVerdict(0, 100)).toBe('A'))
  it('同分 → 平局', () => expect(compareVerdict(42, 42)).toBe('draw'))
})
