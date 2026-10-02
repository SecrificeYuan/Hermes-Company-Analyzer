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

  it('LITE 对比页术语', () => {
    const c = getTerms('lite').compare
    expect(c.title).toBe('双公司对战')
    expect(c.action).toBe('开战')
    expect(c.actionLoading).toBe('分析中…')
    expect(c.winnerTemplate).toBe('{name} 胜 · 更健康')
    expect(c.drawLabel).toBe('势均力敌')
    expect(c.slotLabel).toBe('PLAYER {slot}')
    expect(c.cardTitles.table).toBe('关键指标对比')
    expect(c.cardTitles.trend).toBe('趋势对决')
    expect(c.cardTitles.risk).toBe('风险状态对决')
  })

  it('PRO 对比页术语', () => {
    const c = getTerms('pro').compare
    expect(c.title).toBe('双公司对比')
    expect(c.action).toBe('开始对比')
    expect(c.actionLoading).toBe('对比分析中…')
    expect(c.winnerTemplate).toBe('{name} 综合占优')
    expect(c.drawLabel).toBe('基本一致')
    expect(c.slotLabel).toBe('公司 {slot}')
    expect(c.cardTitles.trend).toBe('趋势对比')
    expect(c.cardTitles.risk).toBe('风险事件对比')
    expect(c.llmTitle).toBe('AI 深度对比')
  })
})
