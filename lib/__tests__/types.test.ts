import { describe, it, expect } from 'vitest'
import type { CompanyXRay } from '@/lib/types'
import { makeXray } from './fixtures'

describe('CompanyXRay.nextSteps（增量可选字段）', () => {
  it('不含 nextSteps 的 fixture 仍可赋值给 CompanyXRay（v1.x 增量不破坏既有消费者）', () => {
    const xray: CompanyXRay = makeXray()
    expect(xray.nextSteps).toBeUndefined()
  })

  it('nextSteps 结构：scenario/items/caveat 三元组 + generatedAt/model 元信息', () => {
    const ns: NonNullable<CompanyXRay['nextSteps']> = {
      scenario: '买理财',
      items: ['问销售牌照编号并官网验真'],
      caveat: '历史不代表未来',
      generatedAt: '2026-10-03T00:00:00.000Z',
      model: 'ling-3.1-flash',
    }
    expect(ns.items).toHaveLength(1)
  })

  it('含 nextSteps 的 xray 可被整体赋值并透传', () => {
    const xray: CompanyXRay = makeXray({
      nextSteps: {
        scenario: '入职背调',
        items: ['查工商年报', '查司法执行', '问离职员工'],
        caveat: '舆情仅供参考',
        generatedAt: '2026-10-03T00:00:00.000Z',
        model: 'ling-3.1-flash',
      },
    })
    expect(xray.nextSteps?.items).toHaveLength(3)
  })
})
