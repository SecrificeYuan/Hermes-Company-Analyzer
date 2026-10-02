import { describe, expect, it } from 'vitest'
import { analyze } from '@/lib/analysis/analyze'
import { scoreAttack } from '@/lib/analysis/scoring/attack'
import { classifyAnnouncement } from '@/lib/data/adapters/cninfo'
import { narrativeOf } from '@/lib/narrative'
import type { RawCompanyData } from '@/lib/types'

const baseRaw: RawCompanyData = {
  meta: {
    id: '600926',
    name: '杭州银行',
    stockCode: '600926',
    industry: '银行',
    fetchedAt: '2026-10-02T00:00:00.000Z',
    sources: [],
  },
  financial: {
    years: [{
      year: '2025', revenue: 100000, netProfit: 20000, operatingCashFlow: 30000, debtRatio: 50,
    }],
  },
}

describe('公告司法分类', () => {
  it('不会把经营披露中的“执行情况”误判为诉讼', () => {
    expect(classifyAnnouncement('杭州银行估值提升计划2026年上半年执行情况评估报告')).toBe('其他')
    expect(classifyAnnouncement('关于年度经营计划执行报告的公告')).toBe('其他')
  })

  it('保留明确司法程序的诉讼分类', () => {
    expect(classifyAnnouncement('关于仲裁事项的公告')).toBe('诉讼')
    expect(classifyAnnouncement('收到法院强制执行裁定书的公告')).toBe('诉讼')
    expect(classifyAnnouncement('被执行事项进展公告')).toBe('诉讼')
  })

  it('执行情况报告不会进入 legal 时间线', () => {
    const announcement = {
      date: '2026-08-27',
      title: '杭州银行估值提升计划暨行动方案2026年上半年执行情况评估报告',
      type: classifyAnnouncement('杭州银行估值提升计划暨行动方案2026年上半年执行情况评估报告'),
      url: 'https://example.test/announcement',
    }
    const xray = analyze({ ...baseRaw, announcements: [announcement] })
    expect(xray.timeline.some((event) => event.category === 'legal')).toBe(false)
  })
})

describe('司法数据缺失', () => {
  it('不会把占位分数和零条记录作为真实司法结论', () => {
    expect(scoreAttack(undefined)).toMatchObject({
      score: 50,
      label: '暂无法判断',
      lawsuitCount: 0,
      executionAmount: 0,
      available: false,
    })
  })

  it('缺失司法切片不会参与综合风险或生成涉诉叙事', () => {
    const unknown = analyze(baseRaw)
    const verifiedNoRecords = analyze({
      ...baseRaw,
      legal: { lawsuits: [], executions: [], dishonest: 0 },
    })

    expect(unknown.atk.available).toBe(false)
    expect(unknown.riskScore).toBeGreaterThan(verifiedNoRecords.riskScore)
    expect(narrativeOf(unknown).type).not.toBe('lawsuit')
  })
})
