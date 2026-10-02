import { describe, expect, it } from 'vitest'
import { narrativeCopy, NARRATIVE_ICONS } from '@/lib/narrative-copy'
import { LITE_BANNED_TERMS } from '@/lib/theme/terms'
import { analyze } from '@/lib/analysis/analyze'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import healthyJson from '@/data/mock/company-healthy.json'
import type { RawCompanyData } from '@/lib/types'

const raw = (j: unknown) => j as RawCompanyData
const KEYS = ['hp', 'def', 'atk', 'morale', 'network'] as const

describe('narrativeCopy', () => {
  it('五把钥匙在三家 mock 上全部产出非空大数字/说明/文案', () => {
    for (const j of [dangerJson, warningJson, healthyJson]) {
      const x = analyze(raw(j))
      for (const k of KEYS) {
        const m = narrativeCopy(k, x)
        expect(m.big).toBeTruthy()
        expect(m.caption).toBeTruthy()
        expect(m.text.length).toBeGreaterThan(10)
        expect(NARRATIVE_ICONS[k]).toBeTruthy()
      }
    }
  })

  it('LITE 文案零禁用术语（反向校验，规格 §10）', () => {
    for (const j of [dangerJson, warningJson, healthyJson]) {
      const x = analyze(raw(j))
      for (const k of KEYS) {
        const m = narrativeCopy(k, x)
        for (const term of LITE_BANNED_TERMS) {
          expect(`${m.caption}|${m.text}`).not.toContain(term)
        }
      }
    }
  })

  it('llm.sectionNotes 覆盖模板文案（danger 的 def 卡）', () => {
    const x = analyze(raw(dangerJson))
    expect(narrativeCopy('def', x).text).toContain('押到极限')
  })

  it('无 llm 时回落模板（healthy）', () => {
    const x = analyze(raw(healthyJson))
    expect(narrativeCopy('hp', x).text).toContain('债')
  })
})
