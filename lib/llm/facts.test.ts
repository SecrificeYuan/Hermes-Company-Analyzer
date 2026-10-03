import { describe, it, expect } from 'vitest'
import { makeXray } from '@/lib/__tests__/fixtures'
import {
  buildFactPayload,
  buildSignalPayload,
  assertNumbersTraceable,
  assertNumbersTraceableAny,
} from './facts'
import type { CompanyXRay } from '@/lib/types'

const xray = makeXray({
  id: 't1', name: '测试公司', overallRisk: 'yellow', riskScore: 62,
  hp: { score: 72, label: '良好', cashFlow: 3800000, debtRatio: 23, trend: [100, 200] },
  def: { score: 65, label: '一般', pledgeRatio: 30, assetCoverage: 150 },
  hiddenStatus: [
    { id: 's1', label: '高质押', severity: 'high', description: '质押比例偏高', evidence: [{ source: '快照', date: '2026-10-01', detail: '质押 30% 触及预警' }] },
  ],
  asOf: '2026-10-03',
}) as CompanyXRay

describe('lib/llm/facts', () => {
  it('buildFactPayload 覆盖五维，缺数据维度如实标注', () => {
    const facts = buildFactPayload(xray)
    expect(facts.hp).toBeTruthy()
    expect(facts.hp.资产负债率).toBe('23%')
    expect(facts.def).toBeTruthy()
    // available 未显式 false 时返回正常分数对象（数据可用）
    expect(facts.atk.评分).toBe('50/100（）')
    expect(facts.network.关联实体数).toBe(0)
  })

  it('atk 未取回时标注数据缺口', () => {
    const noAtk = makeXray({ atk: { score: 50, label: '', lawsuitCount: 0, executionAmount: 0, available: false } })
    const facts = buildFactPayload(noAtk)
    expect(facts.atk.数据可用).toBe(false)
  })

  it('buildSignalPayload 无信号时返回诚实字符串', () => {
    const clean = makeXray({ hiddenStatus: [] })
    expect(buildSignalPayload(clean)).toBe('未发现异常信号')
  })

  it('assertNumbersTraceable：喂料中存在的数字通过，无中生有拒绝', () => {
    expect(assertNumbersTraceable('资产负债率 23% 偏高', xray)).toBe(true)
    expect(assertNumbersTraceable('风险评分 62 属于黄灯', xray)).toBe(true)
    expect(assertNumbersTraceable('神秘的 99% 问题', xray)).toBe(false)
  })

  it('assertNumbersTraceableAny：两家公司数字均合法', () => {
    const other = makeXray({ id: 't2', hp: { score: 88, label: '', cashFlow: 0, debtRatio: 10, trend: [] } })
    expect(assertNumbersTraceableAny('甲 72% 对乙 88%', [xray, other])).toBe(true)
    expect(assertNumbersTraceableAny('甲 55% 未知', [xray, other])).toBe(false)
  })
})
