import { describe, expect, it } from 'vitest'
import { analyze } from '@/lib/analysis/analyze'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import type { RawCompanyData } from '@/lib/types'
import { registryFromProfile } from '@/lib/data/adapters/profile'

const raw = (j: unknown) => j as RawCompanyData

describe('契约层扩展', () => {
  it('registry 从 RawCompanyData.meta 透传到 CompanyXRay', () => {
    const x = analyze(raw(dangerJson))
    expect(x.registry?.fullName).toBe('恒晟地产集团有限公司')
    expect(x.registry?.creditCode).toBe('91330100MA2B7X9K3Q')
    expect(x.registry?.registeredCapital).toBe(156000)
  })

  it('asOf 锚定 meta.fetchedAt（而非分析时刻）', () => {
    const x = analyze(raw(dangerJson))
    expect(x.asOf).toBe('2026-10-01T09:00:00+08:00')
  })

  it('llm 示例从 mock 透传', () => {
    const x = analyze(raw(dangerJson))
    expect(x.llm?.sectionNotes?.def).toContain('押')
  })

  it('warning mock 无 registry —— 降级为 undefined 而不报错', () => {
    const x = analyze(raw(warningJson))
    expect(x.registry).toBeUndefined()
    expect(x.llm).toBeUndefined()
  })
})

describe('东方财富 F10 公司概况映射', () => {
  const row = {
    ORG_NAME: ' 杭州银行股份有限公司 ',
    REG_NUM: '91330000253924826D',
    FOUND_DATE: '1996-09-25 00:00:00',
    REG_CAPITAL: 724900.2548,
    ORG_PROFILE: ' 杭州银行  是一家上市银行。 ',
    MAIN_BUSINESS: '公司金融,零售金融',
  }

  it('保留经过验证的基本资料、简介和 F10 证据链接', () => {
    expect(registryFromProfile(row, '600926')).toEqual({
      fullName: '杭州银行股份有限公司',
      creditCode: '91330000253924826D',
      foundedAt: '1996-09-25',
      registeredCapital: 724900.25,
      profile: '杭州银行 是一家上市银行。',
      mainBusiness: '公司金融,零售金融',
      sourceUrl: 'https://f10.eastmoney.com/f10_v2/CompanySurvey.aspx?code=sh600926',
    })
  })

  it('缺少关键工商字段时不构造不完整资料', () => {
    expect(registryFromProfile({ ...row, REG_NUM: null }, '600926')).toBeNull()
  })
})
