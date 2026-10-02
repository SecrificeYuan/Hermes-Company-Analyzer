import { describe, expect, it } from 'vitest'
import { financialYears } from '@/lib/data/adapters/financial'
import { scoreHp } from '@/lib/analysis/scoring/hp'
import { extractPledgeRatio } from '@/lib/analysis/scoring/defense'
import { buildGraph } from '@/lib/analysis/graph'
import type { RawCompanyData } from '@/lib/types'

// 模拟东方财富 F10 主表 + 现金流量表行（银行业 LD 恒为 null）
const summaryRow = (year: string, ld: number | null) => ({
  REPORT_DATE: `${year}-12-31 00:00:00`,
  TOTALOPERATEREVE: 38798611000,
  PARENTNETPROFIT: 19029250000,
  ZCFZL: 93.09,
  LD: ld,
})
const cashRow = (year: string) => ({
  REPORT_DATE: `${year}-12-31 00:00:00`,
  NETCASH_OPERATE: -4767298896,
})

describe('financialYears：流动比率缺省（银行）', () => {
  it('LD 为 null 时保留该年，currentRatio 缺省', () => {
    const years = financialYears(
      [summaryRow('2025', null)],
      [cashRow('2025')],
    )
    expect(years).toHaveLength(1)
    expect(years[0].year).toBe('2025')
    expect(years[0].currentRatio).toBeUndefined()
    expect(years[0].operatingCashFlow).toBeCloseTo(-476729.89, 1)
  })

  it('LD 正常时照旧输出 currentRatio', () => {
    const years = financialYears(
      [summaryRow('2025', 1.5)],
      [cashRow('2025')],
    )
    expect(years[0].currentRatio).toBe(1.5)
  })

  it('核心字段缺失仍跳过该年', () => {
    const years = financialYears(
      [{ ...summaryRow('2025', null), TOTALOPERATEREVE: null }],
      [cashRow('2025')],
    )
    expect(years).toHaveLength(0)
  })
})

describe('scoreHp：currentRatio 缺省按中性计', () => {
  const base = {
    year: '2025',
    revenue: 100000,
    netProfit: 20000,
    operatingCashFlow: 30000,
    debtRatio: 50,
  }

  it('缺省与显式给定同一值时分数一致（中性 50 → crScore=50）', () => {
    const without = scoreHp({ years: [{ ...base }] })
    const withNeutral = scoreHp({ years: [{ ...base, currentRatio: 1 }] })
    expect(without.score).toBe(withNeutral.score)
  })

  it('缺省不影响现金流与负债维度输出', () => {
    const hp = scoreHp({ years: [{ ...base }] })
    expect(hp.cashFlow).toBe(30000)
    expect(hp.debtRatio).toBe(50)
    expect(hp.trend).toEqual([30000])
  })
})

describe('extractPledgeRatio：质押适配器事件形态', () => {
  it('amount 取累计质押比例（百分数）最大值', () => {
    const people = [
      { name: '股东整体质押', role: '股东', event: '质押', date: '2026-09-30', amount: 0.74 },
      { name: '股东整体质押', role: '股东', event: '质押', date: '2026-09-24', amount: 0.8 },
    ]
    expect(extractPledgeRatio(people)).toBe(0.8)
  })
})

describe('buildGraph：十大股东节点', () => {
  const raw = {
    meta: {
      id: '600926', name: '杭州银行', industry: '银行', fetchedAt: '2026-10-02T00:00:00Z', sources: [],
    },
    shareholders: [
      { name: '红狮控股集团有限公司', ratio: 6.09, isInstitution: true, date: '2026-06-30' },
      { name: '某某个人', ratio: 35.5, isInstitution: false, date: '2026-06-30' },
    ],
  } as unknown as RawCompanyData

  it('每个股东生成 holder 节点与持股边', () => {
    const graph = buildGraph(raw, 40)
    const holderNodes = graph.nodes.filter((n) => n.type === 'holder')
    expect(holderNodes).toHaveLength(2)
    const link = graph.links.find((l) => l.source === 'holder:红狮控股集团有限公司')
    expect(link?.label).toContain('6.09%')
  })

  it('持股超 30% 标风险边', () => {
    const graph = buildGraph(raw, 40)
    const risky = graph.links.find((l) => l.source === 'holder:某某个人')
    expect(risky?.risk).toBe(true)
  })

  it('最多挂前 8 个股东', () => {
    const many = {
      ...raw,
      shareholders: Array.from({ length: 12 }, (_, i) => ({
        name: `股东${i}`, ratio: 10 - i * 0.5, isInstitution: true,
      })),
    } as unknown as RawCompanyData
    const graph = buildGraph(many, 40)
    expect(graph.nodes.filter((n) => n.type === 'holder')).toHaveLength(8)
  })
})
