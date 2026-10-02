import { beforeEach, describe, expect, it } from 'vitest'
import { addSearchHistory, getSearchHistory } from '@/lib/search-history'

const company = (id: string, name = `公司${id}`) => ({ id, name, stockCode: `${id}.SH` })

describe('search history', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('空存储返回空数组', () => {
    expect(getSearchHistory()).toEqual([])
  })

  it('追加后置顶并返回完整列表', () => {
    const next = addSearchHistory(company('600519'))
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ id: '600519', name: '公司600519' })
    expect(typeof next[0].at).toBe('number')
    expect(getSearchHistory()).toEqual(next)
  })

  it('同 id 去重：再次搜索移到最前', () => {
    addSearchHistory(company('600519'))
    addSearchHistory(company('000001'))
    const next = addSearchHistory(company('600519'))
    expect(next.map((r) => r.id)).toEqual(['600519', '000001'])
  })

  it('最多保留 3 条，最旧被淘汰', () => {
    addSearchHistory(company('1'))
    addSearchHistory(company('2'))
    addSearchHistory(company('3'))
    const next = addSearchHistory(company('4'))
    expect(next.map((r) => r.id)).toEqual(['4', '3', '2'])
    expect(getSearchHistory()).toHaveLength(3)
  })

  it('损坏的 JSON 返回空数组', () => {
    window.localStorage.setItem('hermes-search-history', '{oops')
    expect(getSearchHistory()).toEqual([])
  })

  it('非记录元素被过滤', () => {
    window.localStorage.setItem(
      'hermes-search-history',
      JSON.stringify([{ id: '600519', name: '贵州茅台', stockCode: '600519.SH', at: 1 }, { bad: true }]),
    )
    const list = getSearchHistory()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('600519')
  })
})
