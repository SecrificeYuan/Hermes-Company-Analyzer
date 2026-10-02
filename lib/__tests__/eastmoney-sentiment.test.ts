import { describe, expect, it } from 'vitest'
import { mergeSentimentItems, parseEastmoneyNews, parseJsonp, scoreNewsTone } from '@/lib/data/adapters/eastmoney-sentiment'
import { scoreMorale } from '@/lib/analysis/scoring/morale'
import { sentimentWordFrequency } from '@/lib/analysis/sentiment-word-frequency'

describe('东方财富新闻解析', () => {
  it('保留可追溯链接、去重并按日期升序输出', () => {
    const result = parseEastmoneyNews({
      result: {
        cmsArticleWebOld: [
          { date: '2026-09-30 16:27:56', title: '<em>杭州银行</em>被罚975万', content: '监管处罚', mediaName: '大河财立方', url: 'https://bank.eastmoney.com/a/1.html' },
          { date: '2026-08-27 09:20:33', title: '杭州银行净利润增长', content: '同比增长', mediaName: '界面新闻', url: 'https://finance.eastmoney.com/a/2.html' },
          { date: '2026-09-30 16:27:56', title: '<em>杭州银行</em>被罚975万', content: '监管处罚', mediaName: '大河财立方', url: 'https://bank.eastmoney.com/a/1.html' },
        ],
      },
    })

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ date: '2026-08-27', headline: '杭州银行净利润增长', url: 'https://finance.eastmoney.com/a/2.html' })
    expect(result.items[1].tone).toBeLessThan(0)
    expect(result.coverage).toEqual({ from: '2026-08-27', to: '2026-09-30' })
  })

  it('只接受有效 JSONP，避免把上游异常 HTML 当作新闻', () => {
    expect(parseJsonp('hermesNews({"result":{"cmsArticleWebOld":[]}})')).toEqual({ result: { cmsArticleWebOld: [] } })
    expect(() => parseJsonp('<html>upstream error</html>')).toThrow('INVALID_JSONP')
  })

  it('将东方财富的业务错误标记为失败，而不是误报为没有新闻', () => {
    expect(() => parseEastmoneyNews({ code: 406, result: { cmsArticleWebOld: [] } })).toThrow('EASTMONEY_NEWS_RESPONSE_ERROR')
  })

  it('提供逐页回补所需的 hasMore，并在合并页数据时去重排序', () => {
    const first = parseEastmoneyNews({
      hitsTotal: 61,
      result: { cmsArticleWebOld: [{ date: '2026-09-30', title: '新闻 A' }] },
    }, 1)
    expect(first.hasMore).toBe(true)
    const merged = mergeSentimentItems(
      [{ date: '2026-09-30', tone: 0, headline: '新闻 A', source: '来源' }],
      [{ date: '2026-09-01', tone: 3, headline: '新闻 B', source: '来源' }, { date: '2026-09-30', tone: 0, headline: '新闻 A', source: '来源' }],
    )
    expect(merged.map((item) => item.headline)).toEqual(['新闻 B', '新闻 A'])
  })
})

describe('舆情初筛边界', () => {
  it('负面监管词与正面业绩词产生可解释的方向', () => {
    expect(scoreNewsTone('杭州银行被罚975万，14人遭警告')).toBeLessThan(0)
    expect(scoreNewsTone('杭州银行净利润增长，获机构上调评级')).toBeGreaterThan(0)
  })

  it('没有任何舆情数据时标记为不可判断，而非可展示的中性结论', () => {
    const morale = scoreMorale(undefined, new Date('2026-10-02T00:00:00Z'))
    expect(morale).toMatchObject({ score: 50, avgTone: 0, label: '暂无法判断', available: false })
    expect(morale.trend).toEqual([])
  })
})

describe('舆情词频', () => {
  it('只统计新闻标题中的财经词，并按频次输出', () => {
    const words = sentimentWordFrequency([
      { date: '2026-09-01', tone: 6, headline: '净利润增长，获机构上调评级', source: '来源' },
      { date: '2026-09-02', tone: -3, headline: '业绩增长但风险仍需关注', source: '来源' },
      { date: '2026-09-03', tone: -6, headline: '监管处罚与风险提示', source: '来源' },
    ])
    expect(words[0]).toMatchObject({ text: '风险', count: 2 })
    expect(words.find((word) => word.text === '增长')).toMatchObject({ count: 2 })
    expect(words.find((word) => word.text === '风险')).toMatchObject({ count: 2, avgTone: -4.5 })
    expect(words.some((word) => word.text === '杭州银行')).toBe(false)
  })
})
