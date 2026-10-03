// 股票提及 tokenize：命名提及 / 裸代码 / 代码块豁免 / 粘连句子
import { describe, expect, it } from 'vitest'
import { tokenizeStockMentions } from '@/components/chat/Markdown'

describe('tokenizeStockMentions', () => {
  it('识别 名称（代码.交易所） 形态', () => {
    const segs = tokenizeStockMentions('你说的「ST金花」按附件核实的 ST金花（600080.SH） 来分析。')
    const stocks = segs.filter((s) => s.stock)
    expect(stocks).toHaveLength(1)
    expect(stocks[0].stock).toEqual({ name: 'ST金花', code: '600080', exchange: 'SH' })
    // 命中之外的句子保持完整
    expect(segs[0].text).toContain('按附件核实的')
  })

  it('识别半角括号与裸代码', () => {
    const segs = tokenizeStockMentions('看看 600080.SH 和 ST金花(600080.SH) 吧')
    const stocks = segs.filter((s) => s.stock)
    expect(stocks).toHaveLength(2)
    expect(stocks[0].stock?.code).toBe('600080')
    expect(stocks[1].stock?.name).toBe('ST金花')
  })

  it('fenced code block 内的代码不识别', () => {
    const segs = tokenizeStockMentions('```\n600080.SH\n```\n正文 600080.SH')
    const stocks = segs.filter((s) => s.stock)
    expect(stocks).toHaveLength(1)
  })

  it('句子粘连的长名称取尾部短名', () => {
    const segs = tokenizeStockMentions('如果指的是按附件核实的ST金花（600080.SH）就好')
    const stock = segs.find((s) => s.stock)?.stock
    expect(stock?.name).toBe('ST金花')
  })

  it('普通数字不误伤', () => {
    const segs = tokenizeStockMentions('负债 600080 万元，市盈率 12.5 倍')
    expect(segs.filter((s) => s.stock)).toHaveLength(0)
  })
})
