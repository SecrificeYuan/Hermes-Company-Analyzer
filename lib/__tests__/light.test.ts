import { describe, expect, it } from 'vitest'
import { deriveLight } from '@/lib/analysis/light'
import { analyze } from '@/lib/analysis/analyze'
import { healthToXray } from '@/lib/data/health-xray'
import type { CompanyHealth } from '@/lib/company'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import healthyJson from '@/data/mock/company-healthy.json'
import { LITE_BANNED_TERMS } from '@/lib/theme/terms'
import type { HiddenStatus, RawCompanyData } from '@/lib/types'

const raw = (j: unknown) => j as RawCompanyData

const debuff = (over: Partial<HiddenStatus> = {}): HiddenStatus => ({
  id: 'x', label: '老板套现', severity: 'mid', description: '测试描述', evidence: [],
  ...over,
})

describe('deriveLight', () => {
  it('基准档：overallRisk 三档映射固定 headline', () => {
    expect(deriveLight({ overallRisk: 'green', hiddenStatus: [], coverage: 'full' }).headline).toBe('这钱能付')
    expect(deriveLight({ overallRisk: 'yellow', hiddenStatus: [], coverage: 'full' }).headline).toBe('能付，但换个付法')
    expect(deriveLight({ overallRisk: 'red', hiddenStatus: [], coverage: 'full' }).headline).toBe('先别付这钱')
  })

  it('修饰1：fatal 命中直接红（哪怕基准绿）', () => {
    const r = deriveLight({ overallRisk: 'green', hiddenStatus: [debuff({ fatal: true })], coverage: 'full' })
    expect(r.color).toBe('red')
    expect(r.headline).toBe('先别付这钱')
  })

  it('修饰2：非 fatal ≥3 升一档（绿→黄）', () => {
    const r = deriveLight({ overallRisk: 'green', hiddenStatus: [debuff(), debuff({ id: 'y' }), debuff({ id: 'z' })], coverage: 'full' })
    expect(r.color).toBe('yellow')
    expect(r.saferAdvice).toBeTruthy()
  })

  it('修饰2：黄基准+≥3 升红', () => {
    const r = deriveLight({ overallRisk: 'yellow', hiddenStatus: [debuff(), debuff({ id: 'y' }), debuff({ id: 'z' })], coverage: 'full' })
    expect(r.color).toBe('red')
  })

  it('1–2 条命中黄灯带 saferAdvice；0 命中绿灯无 saferAdvice', () => {
    const one = deriveLight({ overallRisk: 'green', hiddenStatus: [debuff()], coverage: 'full' })
    expect(one.color).toBe('yellow')
    expect(one.saferAdvice).toBeTruthy()
    const zero = deriveLight({ overallRisk: 'green', hiddenStatus: [], coverage: 'full' })
    expect(zero.color).toBe('green')
    expect(zero.saferAdvice).toBeUndefined()
  })

  it('修饰3：覆盖不足时绿色基准压黄 + limitedSignals', () => {
    const r = deriveLight({ overallRisk: 'green', hiddenStatus: [], coverage: 'partial' })
    expect(r.color).toBe('yellow')
    expect(r.limitedSignals).toBe(true)
    expect(r.reason).toContain('不全')
  })

  it('reason/saferAdvice 零禁用术语', () => {
    const cases = [
      deriveLight({ overallRisk: 'red', hiddenStatus: [debuff({ severity: 'high' })], coverage: 'full' }),
      deriveLight({ overallRisk: 'green', hiddenStatus: [], coverage: 'partial' }),
      deriveLight({ overallRisk: 'yellow', hiddenStatus: [debuff()], coverage: 'full' }),
    ]
    for (const c of cases) {
      for (const term of LITE_BANNED_TERMS) {
        expect(`${c.headline}|${c.reason}|${c.saferAdvice ?? ''}`).not.toContain(term)
      }
    }
  })
})

describe('analyze 挂灯（三档回归 + 灯断言）', () => {
  it('healthy→绿灯能付；warning→黄灯带 saferAdvice；danger→红灯先别付', () => {
    const h = analyze(raw(healthyJson))
    expect(h.overallRisk).toBe('green')
    expect(h.light).toMatchObject({ color: 'green', headline: '这钱能付' })
    const w = analyze(raw(warningJson))
    expect(w.overallRisk).toBe('yellow')
    expect(w.light).toMatchObject({ color: 'yellow', headline: '能付，但换个付法' })
    expect(w.light?.saferAdvice).toBeTruthy()
    expect(w.hiddenStatus.find((d) => d.id === 'pledge-pierce')?.tier).toEqual({ current: 2, max: 3 })
    const d = analyze(raw(dangerJson))
    expect(d.overallRisk).toBe('red')
    expect(d.light).toMatchObject({ color: 'red', headline: '先别付这钱' })
  })
})

const healthOf = (overall: 'partial' | 'insufficient', financialRisk: 'low' | 'medium' | 'high' | null): CompanyHealth => ({
  company: { id: 'gym-1', name: '测试健身房', listing: 'unlisted', identity: 'lead', sources: [] },
  asOf: '2026-10-01T00:00:00Z',
  financialYear: null, years: [],
  metrics: { revenueGrowth: null, netMargin: null, debtRatio: null, currentRatio: null, netProfit: null, operatingCashFlow: null, pledgeRatio: null, lawsuitAnnouncements: null, executionAnnouncements: null },
  financialRisk, riskReasons: financialRisk ? ['测试原因'] : [], overall, gaps: ['财务报表'],
  investment: { status: 'needs_due_diligence', annualizedReturn: null, minimumInvestment: null, exitMonths: null, reason: '资料不足，无法给出回报率。' },
  sources: [], announcements: [],
} as unknown as CompanyHealth)

describe('非上市灯（healthToXray）', () => {
  it('覆盖不足时绿色基准压黄 + limitedSignals', () => {
    const x = healthToXray(healthOf('insufficient', 'low'))
    expect(x.light).toMatchObject({ color: 'yellow', limitedSignals: true })
    expect(x.light?.reason).toContain('不全')
  })
  it('覆盖 partial 同理压黄', () => {
    expect(healthToXray(healthOf('partial', 'low')).light?.color).toBe('yellow')
  })
})
