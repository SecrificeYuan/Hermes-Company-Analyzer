import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CompanyXRay } from '@/lib/types'
import { makeXray } from '@/lib/__tests__/fixtures'

const base = makeXray({})
const a = {
  ...base,
  id: 'mock-a', name: '甲公司', overallRisk: 'red' as const,
  hp: { ...base.hp, score: 12 },
  verdict: '模板结论A', advice: '模板建议A', asOf: '2026-10-03',
} as CompanyXRay
const b = {
  ...base,
  id: 'mock-b', name: '乙公司', overallRisk: 'green' as const,
  hp: { ...base.hp, score: 88 },
  verdict: '模板结论B', advice: '模板建议B', asOf: '2026-10-03',
} as CompanyXRay

describe('lib/llm/compare-narrative', () => {
  beforeEach(() => { vi.resetModules() })

  it('buildCompareMessages：system 含双方公司名、要求与铁律；user 喂双方维度事实', async () => {
    const { buildCompareMessages } = await import('./compare-narrative')
    const msgs = buildCompareMessages(a, b, 'summary')
    const sys = msgs.find((m) => m.role === 'system')!.content!
    expect(sys).toContain('甲公司')
    expect(sys).toContain('乙公司')
    expect(sys).toContain('历史不代表未来')
    const user = msgs.find((m) => m.role === 'user')!.content!
    expect(user).toContain('维度事实')
    expect(user).toContain('综合差值')
  })

  it('parseCompareInsight：summary/verdict 合法返回字符串', async () => {
    const { parseCompareInsight } = await import('./compare-narrative')
    expect(parseCompareInsight('summary', JSON.stringify({ summary: '甲资产负债率高，乙更稳。历史不代表未来' }), a, b))
      .toBe('甲资产负债率高，乙更稳。历史不代表未来')
    expect(parseCompareInsight('verdict', JSON.stringify({ verdict: '付款给乙公司更稳' }), a, b))
      .toBe('付款给乙公司更稳')
  })

  it('parseCompareDimensionNotes：五维合法返回对象，坏键被丢弃', async () => {
    const { parseCompareDimensionNotes } = await import('./compare-narrative')
    const raw = JSON.stringify({ dimensionNotes: { hp: '甲血条仅 12%，乙 88% 远稳', def: '乙护甲更高', junk: 'x' } })
    const notes = parseCompareDimensionNotes(raw, a, b)
    expect(notes).toEqual({ hp: '甲血条仅 12%，乙 88% 远稳', def: '乙护甲更高' })
  })

  it('跨公司数字守卫：任一家公司面板里的数字均合法，无中生有的数字拒绝', async () => {
    const { parseCompareInsight } = await import('./compare-narrative')
    // 12 出自甲、88 出自乙 → 均通过
    const ok = JSON.stringify({ verdict: '甲 12% 对乙 88%，乙稳' })
    expect(parseCompareInsight('verdict', ok, a, b)).toBe('甲 12% 对乙 88%，乙稳')
    // 7 无出处 → 拒绝
    const bad = JSON.stringify({ verdict: '甲 7% 高风险' })
    expect(parseCompareInsight('verdict', bad, a, b)).toBeNull()
  })

  it('parseCompareInsight：非 JSON / 缺字段 / 空串 → null', async () => {
    const { parseCompareInsight } = await import('./compare-narrative')
    expect(parseCompareInsight('summary', 'not json', a, b)).toBeNull()
    expect(parseCompareInsight('summary', JSON.stringify({ other: 'x' }), a, b)).toBeNull()
    expect(parseCompareInsight('verdict', null, a, b)).toBeNull()
  })
})
