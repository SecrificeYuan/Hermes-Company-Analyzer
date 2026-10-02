import { describe, expect, it } from 'vitest'
import { narrativeOf, glanceLayout, detailOrder } from '@/lib/narrative'
import { analyze } from '@/lib/analysis/analyze'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import healthyJson from '@/data/mock/company-healthy.json'
import type { CompanyXRay, RawCompanyData, TimelineEvent } from '@/lib/types'
import { makeXray } from './fixtures'

const legalTimeline = (n: number): TimelineEvent[] =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    event: `诉讼${i}`,
    category: 'legal' as const,
    severity: 'mid' as const,
  }))

describe('narrativeOf', () => {
  it('契约字段优先于一切本地推导', () => {
    const r = narrativeOf(makeXray({ narrative: 'sentiment', def: { score: 0, label: '', pledgeRatio: 99, assetCoverage: 0 } }))
    expect(r).toEqual({ type: 'sentiment', via: 'contract' })
  })

  it('质押触发器：60% 命中，59% 不命中', () => {
    expect(narrativeOf(makeXray({ def: { score: 80, label: '', pledgeRatio: 60, assetCoverage: 2 } })).type).toBe('pledge')
    const r = narrativeOf(makeXray({ def: { score: 80, label: '', pledgeRatio: 59, assetCoverage: 2 } }))
    expect(r.type).not.toBe('pledge')
  })

  it('诉讼触发器：近 12 月 legal 事件 ≥5 命中', () => {
    expect(narrativeOf(makeXray({ timeline: legalTimeline(5) })).type).toBe('lawsuit')
    expect(narrativeOf(makeXray({ timeline: legalTimeline(4) })).type).not.toBe('lawsuit')
  })

  it('双触发器同时命中时质押优先', () => {
    const x = makeXray({
      def: { score: 0, label: '', pledgeRatio: 72, assetCoverage: 0 },
      timeline: legalTimeline(9),
    })
    expect(narrativeOf(x)).toEqual({ type: 'pledge', via: 'trigger-pledge' })
  })

  it('健康线：hp/def/morale ≥60 且 atk ≤40 → balanced；atk 41 不命中', () => {
    const healthy = makeXray({
      hp: { score: 70, label: '', cashFlow: 1, debtRatio: 30, trend: [] },
      def: { score: 70, label: '', pledgeRatio: 10, assetCoverage: 2 },
      atk: { score: 40, label: '', lawsuitCount: 1, executionAmount: 0 },
      morale: { score: 70, label: '', avgTone: 2, trend: [] },
    })
    expect(narrativeOf(healthy)).toEqual({ type: 'balanced', via: 'healthy' })
    expect(narrativeOf(makeXray({ ...healthy, atk: { score: 41, label: '', lawsuitCount: 2, executionAmount: 0 } })).type).not.toBe('balanced')
  })

  it('argmax：hp 最危险 → debt', () => {
    const r = narrativeOf(makeXray({
      hp: { score: 20, label: '', cashFlow: -100, debtRatio: 90, trend: [] },
      atk: { score: 15, label: '', lawsuitCount: 1, executionAmount: 0 },
    }))
    expect(r).toEqual({ type: 'debt', via: 'argmax' })
  })

  it('ATK 语义反转：atk.score 最高 → lawsuit', () => {
    const r = narrativeOf(makeXray({
      hp: { score: 65, label: '', cashFlow: 1, debtRatio: 40, trend: [] },
      def: { score: 65, label: '', pledgeRatio: 30, assetCoverage: 2 },
      atk: { score: 90, label: '', lawsuitCount: 8, executionAmount: 1000 },
      morale: { score: 65, label: '', avgTone: 0, trend: [] },
    }))
    expect(r.type).toBe('lawsuit')
  })

  it('平局按 质押>诉讼>资金>舆情 固定优先级', () => {
    const r = narrativeOf(makeXray({
      hp: { score: 70, label: '', cashFlow: 1, debtRatio: 30, trend: [] },
      def: { score: 40, label: '', pledgeRatio: 30, assetCoverage: 1 },
      atk: { score: 60, label: '', lawsuitCount: 5, executionAmount: 0 },
      morale: { score: 70, label: '', avgTone: 0, trend: [] },
    }))
    expect(r.type).toBe('pledge')
  })
})

describe('三家 mock 公司集成（锁定归属）', () => {
  const danger = analyze(dangerJson as unknown as RawCompanyData)
  const warning = analyze(warningJson as unknown as RawCompanyData)
  const healthy = analyze(healthyJson as unknown as RawCompanyData)

  it('danger → 质押告急（触发器）', () => {
    expect(narrativeOf(danger)).toEqual({ type: 'pledge', via: 'trigger-pledge' })
  })
  it('warning → 资金告急（argmax）', () => {
    expect(narrativeOf(warning)).toEqual({ type: 'debt', via: 'argmax' })
  })
  it('healthy → 稳健均衡（健康线）', () => {
    expect(narrativeOf(healthy)).toEqual({ type: 'balanced', via: 'healthy' })
  })
})

describe('glanceLayout / detailOrder', () => {
  const danger = analyze(dangerJson as unknown as RawCompanyData)
  const healthy = analyze(healthyJson as unknown as RawCompanyData)

  it('danger：C 位 equity，其余按危险度降序 + network 恒为末位', () => {
    const l = glanceLayout(danger, narrativeOf(danger))
    expect(l.c).toBe('equity')
    expect(l.rest).toEqual(['finance', 'legal', 'sentiment', 'network'])
  })

  it('healthy：C 位 radar，五图全小', () => {
    const l = glanceLayout(healthy, narrativeOf(healthy))
    expect(l.c).toBe('radar')
    expect(l.rest).toHaveLength(5)
  })

  it('detailOrder：核心 section 同序传导，evidence/ai 恒为末两位', () => {
    const d = detailOrder(glanceLayout(danger, narrativeOf(danger)))
    expect(d[0]).toBe('equity')
    expect(d).toHaveLength(7)
    expect(d.slice(-2)).toEqual(['evidence', 'ai'])
  })
})
