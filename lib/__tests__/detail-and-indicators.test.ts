import { describe, expect, it } from 'vitest'
import { analyze } from '@/lib/analysis/analyze'
import { announcementsFor } from '@/components/xray/detail/announcement-split'
import { boll, cci, macd, rsi } from '@/lib/analysis/indicators'
import type { RawCompanyData } from '@/lib/types'
import healthyJson from '@/data/mock/company-healthy.json'

const raw = healthyJson as unknown as RawCompanyData

describe('CompanyXRay.detail 透传', () => {
  const x = analyze(raw)

  it('透传财务/诉讼/舆情/股东/公告/人事切片', () => {
    expect(x.detail?.financialYears.length).toBe(raw.financial?.years.length ?? 0)
    expect(x.detail?.announcements.length).toBe(raw.announcements?.length ?? 0)
    expect(x.detail?.sentimentItems.length).toBe(raw.sentiment?.length ?? 0)
    expect(x.detail?.shareholders.length).toBe(raw.shareholders?.length ?? 0)
    expect(x.detail?.people.length).toBe(raw.people?.length ?? 0)
    expect(x.detail?.lawsuits.length).toBe(raw.legal?.lawsuits.length ?? 0)
    expect(x.detail?.executions.length).toBe(raw.legal?.executions.length ?? 0)
    expect(x.detail?.dishonest).toBe(raw.legal?.dishonest ?? 0)
  })

  it('字段为引用透传而非拷贝计算', () => {
    expect(x.detail?.financialYears).toBe(raw.financial?.years)
    expect(x.detail?.announcements).toBe(raw.announcements)
  })

  it('raw 缺省切片时退化为空数组', () => {
    const minimal: RawCompanyData = { meta: raw.meta }
    const m = analyze(minimal)
    expect(m.detail?.financialYears).toEqual([])
    expect(m.detail?.announcements).toEqual([])
    expect(m.detail?.people).toEqual([])
  })
})

describe('公告按类型分流', () => {
  const anns = analyze(raw).detail?.announcements ?? []

  it('诉讼/问询 → 涉诉', () => {
    for (const a of announcementsFor('legal', anns)) {
      expect(['诉讼', '问询']).toContain(a.type)
    }
  })

  it('减持/质押 → 股权', () => {
    for (const a of announcementsFor('equity', anns)) {
      expect(['减持', '质押']).toContain(a.type)
    }
  })

  it('其余 → 证据溯源，且三分流互不重叠并覆盖全集', () => {
    const all = [...announcementsFor('legal', anns), ...announcementsFor('equity', anns), ...announcementsFor('evidence', anns)]
    expect(all.length).toBe(anns.length)
  })
})

describe('技术指标派生', () => {
  const closes = Array.from({ length: 60 }, (_, i) => 10 + Math.sin(i / 5) + i * 0.05)

  it('MACD dif 前 25 位 / dea 前 33 位为 null，之后为有限数', () => {
    const { dif, dea, hist } = macd(closes)
    expect(dif[24]).toBeNull()
    expect(Number.isFinite(dif[25]!)).toBe(true)
    expect(dea[32]).toBeNull()
    expect(Number.isFinite(dea[33]!)).toBe(true)
    expect(Number.isFinite(hist[40]!)).toBe(true)
    expect(dea.length).toBe(closes.length)
    expect(hist.length).toBe(closes.length)
  })

  it('RSI 落在 0-100', () => {
    const r = rsi(closes)
    const valid = r.filter((v): v is number => v !== null)
    expect(valid.length).toBeGreaterThan(0)
    for (const v of valid) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100) }
  })

  it('BOLL 上轨 ≥ 中轨 ≥ 下轨', () => {
    const { mid, upper, lower } = boll(closes)
    const i = 40
    expect(upper[i]!).toBeGreaterThanOrEqual(mid[i]!)
    expect(mid[i]!).toBeGreaterThanOrEqual(lower[i]!)
  })

  it('CCI 前 period-1 位为 null', () => {
    const c = cci(closes, closes, closes)
    expect(c[18]).toBeNull()
    expect(Number.isFinite(c[30]!)).toBe(true)
  })
})
