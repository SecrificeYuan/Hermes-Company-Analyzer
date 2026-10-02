import { describe, expect, it } from 'vitest'
import { getTokens, scoreColor } from '@/lib/theme'
import { liteTokens } from '@/lib/theme/themes/lite'
import { proTokens } from '@/lib/theme/themes/pro'

describe('主题 tokens', () => {
  it('lite 保留原霓虹值', () => {
    expect(liteTokens.colors.accent).toBe('#00E5FF')
    expect(liteTokens.colors.bg).toBe('#070B14')
    expect(liteTokens.riskColor.red).toBe('#FF3B5C')
  })

  it('pro 金融终端值', () => {
    expect(proTokens.colors.accent).toBe('#4C8DFF')
    expect(proTokens.colors.bg).toBe('#0B0F1A')
    expect(proTokens.colors.card).toBe('#101625')
    expect(proTokens.colors.edge).toBe('#1E2A42')
    expect(proTokens.colors.danger).toBe('#FF5C6C')
    expect(proTokens.colors.safe).toBe('#3ECF8E')
    expect(proTokens.riskColor.green).toBe('#3ECF8E')
  })

  it('getTokens 按模式返回', () => {
    expect(getTokens('lite').mode).toBe('lite')
    expect(getTokens('pro').mode).toBe('pro')
  })

  it('scoreColor 阈值两主题一致：<30 红, <60 黄, ≥60 绿', () => {
    for (const t of [liteTokens, proTokens]) {
      expect(scoreColor(t, 20)).toBe(t.riskColor.red)
      expect(scoreColor(t, 45)).toBe(t.riskColor.yellow)
      expect(scoreColor(t, 80)).toBe(t.riskColor.green)
    }
  })
})
