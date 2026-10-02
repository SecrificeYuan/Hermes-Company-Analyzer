import { describe, expect, it } from 'vitest'
import { filterPresets, PRESET_COMPANIES } from '@/lib/presets'

describe('filterPresets', () => {
  it('空串或纯空白返回全部预设', () => {
    expect(filterPresets('')).toEqual(PRESET_COMPANIES)
    expect(filterPresets('   ')).toEqual(PRESET_COMPANIES)
  })

  it('按名称子串匹配', () => {
    expect(filterPresets('蓝湾').map((c) => c.id)).toEqual(['mock-warning'])
  })

  it('按 tagline 匹配', () => {
    expect(filterPresets('白酒').map((c) => c.id)).toEqual(['mock-healthy'])
  })

  it('按 id 匹配且大小写不敏感', () => {
    expect(filterPresets('MOCK-DANGER').map((c) => c.id)).toEqual(['mock-danger'])
  })

  it('无匹配返回空数组', () => {
    expect(filterPresets('不存在的公司xyz')).toEqual([])
  })
})
