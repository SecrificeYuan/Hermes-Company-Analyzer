import { describe, expect, it } from 'vitest'
import { analyze } from '@/lib/analysis/analyze'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import type { RawCompanyData } from '@/lib/types'

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
