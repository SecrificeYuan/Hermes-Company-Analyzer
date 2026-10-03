import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetReportAiDbForTest,
  getReportAi,
  saveReportAi,
} from '@/lib/db/report-ai-db'

describe('report-ai-db', () => {
  beforeEach(() => {
    __resetReportAiDbForTest(':memory:')
  })
  afterEach(() => {
    __resetReportAiDbForTest()
  })

  it('miss 时返回 null', () => {
    expect(getReportAi('600519', '2026-10-03')).toBeNull()
  })

  it('save 后 get 能取回同一行', () => {
    saveReportAi('600519', '2026-10-03', {
      summary: '整体稳健',
      lightReason: '灯绿因为底子厚',
      sectionNotes: JSON.stringify({ hp: '现金流好' }),
      model: 'ling-3.1-flash',
      generatedAt: '2026-10-03T01:00:00.000Z',
    })
    const row = getReportAi('600519', '2026-10-03')
    expect(row?.summary).toBe('整体稳健')
    expect(row?.lightReason).toBe('灯绿因为底子厚')
    expect(JSON.parse(row?.sectionNotes ?? '{}')).toEqual({ hp: '现金流好' })
    expect(row?.model).toBe('ling-3.1-flash')
  })

  it('as_of 不同互不影响；同键 upsert 覆盖', () => {
    saveReportAi('600519', '2026-10-01', { summary: '旧', lightReason: '', sectionNotes: '{}', model: 'm', generatedAt: 't1' })
    saveReportAi('600519', '2026-10-02', { summary: '新', lightReason: '', sectionNotes: '{}', model: 'm', generatedAt: 't2' })
    expect(getReportAi('600519', '2026-10-01')?.summary).toBe('旧')
    expect(getReportAi('600519', '2026-10-02')?.summary).toBe('新')

    saveReportAi('600519', '2026-10-02', { summary: '覆盖', lightReason: '', sectionNotes: '{}', model: 'm', generatedAt: 't3' })
    expect(getReportAi('600519', '2026-10-02')?.summary).toBe('覆盖')
  })

  it('不同 report_id 互不影响', () => {
    saveReportAi('600519', '2026-10-03', { summary: 'A', lightReason: '', sectionNotes: '{}', model: 'm', generatedAt: 't' })
    saveReportAi('000001', '2026-10-03', { summary: 'B', lightReason: '', sectionNotes: '{}', model: 'm', generatedAt: 't' })
    expect(getReportAi('600519', '2026-10-03')?.summary).toBe('A')
    expect(getReportAi('000001', '2026-10-03')?.summary).toBe('B')
  })
})
