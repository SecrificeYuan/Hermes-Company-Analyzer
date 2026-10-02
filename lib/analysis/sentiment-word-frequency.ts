import type { SentimentItem } from '@/lib/types'

export interface SentimentWord {
  text: string
  count: number
  avgTone: number
}

/**
 * 面向财经新闻标题的轻量词表。当前数据层只保存原始标题而不保存全文，
 * 因此这里做可解释的词语出现频率统计，而不是把它包装成通用中文分词。
 */
const FINANCE_WORDS = [
  '净利润', '营收', '业绩', '增长', '增幅', '创新高', '上调', '增持', '买入', '回购', '分红', '获批', '中标',
  '机构', '调研', '评级', '股价', '利率', '处罚', '罚款', '被罚', '警告', '违规', '调查', '立案', '诉讼',
  '被执行', '失信', '亏损', '下滑', '减持', '质押', '逾期', '风险', '暴雷', '跌停', '裁员', '欠薪', '停工', '问询', '整改',
] as const

/** 将标题中的词语命中汇总成稳定、可用于词云的频次序列。 */
export function sentimentWordFrequency(items: SentimentItem[], limit = 9): SentimentWord[] {
  const counts = new Map<string, { count: number; toneSum: number }>()
  for (const item of items) {
    for (const word of FINANCE_WORDS) {
      if (!item.headline.includes(word)) continue
      const current = counts.get(word) ?? { count: 0, toneSum: 0 }
      current.count += 1
      current.toneSum += item.tone
      counts.set(word, current)
    }
  }
  return [...counts.entries()]
    .map(([text, value]) => ({ text, count: value.count, avgTone: value.toneSum / value.count }))
    .sort((a, b) => b.count - a.count || Math.abs(b.avgTone) - Math.abs(a.avgTone) || a.text.localeCompare(b.text))
    .slice(0, limit)
}
