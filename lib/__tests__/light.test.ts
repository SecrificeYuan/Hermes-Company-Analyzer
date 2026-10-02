import { describe, expect, it } from 'vitest'
import { deriveLight } from '@/lib/analysis/light'
import { LITE_BANNED_TERMS } from '@/lib/theme/terms'
import type { HiddenStatus } from '@/lib/types'

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
