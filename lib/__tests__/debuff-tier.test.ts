import { describe, expect, it } from 'vitest'
import { detectHiddenStatus } from '@/lib/analysis/debuff/rules'
import type { RawCompanyData } from '@/lib/types'

const rawWithPledge = (amount: number): RawCompanyData =>
  ({
    meta: { id: 't', name: '测试', fetchedAt: '2026-10-01T00:00:00Z', sources: [] },
    people: [{ name: '大股东', role: '控股股东', event: '质押', amount, date: '2026-09-01' }],
  }) as unknown as RawCompanyData

describe('质押三档', () => {
  it('30–39%：触发、mid、tier 1/3', () => {
    const [d] = detectHiddenStatus(rawWithPledge(35), new Date('2026-10-01'))
    expect(d).toMatchObject({ id: 'pledge-pierce', severity: 'mid', tier: { current: 1, max: 3 } })
  })

  it('40–69%：触发、mid、tier 2/3', () => {
    const [d] = detectHiddenStatus(rawWithPledge(45), new Date('2026-10-01'))
    expect(d).toMatchObject({ id: 'pledge-pierce', severity: 'mid', tier: { current: 2, max: 3 } })
  })

  it('≥70%：触发、high、tier 3/3', () => {
    const [d] = detectHiddenStatus(rawWithPledge(72), new Date('2026-10-01'))
    expect(d).toMatchObject({ id: 'pledge-pierce', severity: 'high', tier: { current: 3, max: 3 } })
  })

  it('<30% 与无质押事件：不触发', () => {
    expect(detectHiddenStatus(rawWithPledge(20), new Date('2026-10-01'))).toHaveLength(0)
    expect(detectHiddenStatus(rawWithPledge(0), new Date('2026-10-01'))).toHaveLength(0)
  })
})
