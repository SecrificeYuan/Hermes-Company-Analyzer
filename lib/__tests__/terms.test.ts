import { describe, expect, it } from 'vitest'
import { getTerms } from '@/lib/theme/terms'

describe('术语字典', () => {
  it('LITE 游戏化术语', () => {
    const lite = getTerms('lite')
    expect(lite.healthLabel).toBe('HP · 财务血量')
    expect(lite.hiddenTitle).toBe('HIDDEN STATUS')
    expect(lite.riskScoreCaption).toBe('RISK SCORE')
  })

  it('PRO 金融术语', () => {
    const pro = getTerms('pro')
    expect(pro.healthLabel).toBe('基本面健康度')
    expect(pro.defLabel).toBe('偿债安全垫')
    expect(pro.atkLabel).toBe('涉诉风险')
    expect(pro.moraleLabel).toBe('舆情指数')
    expect(pro.hiddenTitle).toBe('风险事件')
    expect(pro.riskScoreCaption).toBe('HEALTH SCORE')
    expect(pro.radarSeriesName).toBe('五维指标')
  })
})
