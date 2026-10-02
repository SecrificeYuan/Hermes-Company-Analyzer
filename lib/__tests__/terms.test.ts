import { describe, expect, it } from 'vitest'
import { getTerms, LITE_BANNED_TERMS } from '@/lib/theme/terms'

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

describe('重设计扩展术语', () => {
  it('七个 section 名双模式齐备且不同', () => {
    const lite = getTerms('lite')
    const pro = getTerms('pro')
    for (const k of ['financial', 'equity', 'legal', 'sentiment', 'network', 'evidence', 'ai'] as const) {
      expect(lite.sections[k]).toBeTruthy()
      expect(pro.sections[k]).toBeTruthy()
      expect(lite.sections[k]).not.toBe(pro.sections[k])
    }
    expect(pro.sections.financial).toBe('财务详情')
    expect(pro.sections.ai).toBe('AI 分析')
  })

  it('narrativeTitles / dimensionTitles 五键齐备', () => {
    const lite = getTerms('lite')
    for (const k of ['debt', 'pledge', 'lawsuit', 'sentiment', 'balanced'] as const) {
      expect(lite.narrativeTitles[k]).toBeTruthy()
      expect(getTerms('pro').narrativeTitles[k]).toBeTruthy()
    }
    for (const k of ['hp', 'def', 'atk', 'morale', 'network'] as const) {
      expect(lite.dimensionTitles[k]).toBeTruthy()
    }
  })

  it('LITE 文案零禁用术语（反向校验）', () => {
    const lite = getTerms('lite')
    const liteCopy = [
      ...Object.values(lite.sections),
      ...Object.values(lite.narrativeTitles),
      ...Object.values(lite.dimensionTitles),
    ].join('|')
    for (const term of LITE_BANNED_TERMS) {
      expect(liteCopy).not.toContain(term)
    }
  })
})
