import type { RawCompanyData, SentimentItem } from '@/lib/types'
import type { DataAdapter } from '../adapter'

/** GDELT tone 原始值大致在 -20~+20，这里压到契约的 -10~+10 */
function clampTone(t: number): number {
  return Math.max(-10, Math.min(10, Math.round(t)))
}

/**
 * GDELT 舆情适配器（真实免费 API，无需 key，建议作为首个真实数据源）。
 * 文档：https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 *
 * 通过 GDELT_ENABLED=true 启用；网络失败自动降级到 mock。
 *
 * TODO(feat/data-engine)：
 *   1. mode=ArtList 拿标题/来源/日期，tone 字段在 tonechart 模式或文章级接口提取；
 *   2. 中文公司名建议同时查询中英文关键词；
 *   3. 按月聚合成 sentiment[]（升序），每月一条 tone 均值 + 代表性标题。
 */
export const gdeltAdapter: DataAdapter = {
  name: 'gdelt',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      if (process.env.GDELT_ENABLED !== 'true') return null

      const url =
        'https://api.gdeltproject.org/api/v2/doc/doc' +
        `?query=${encodeURIComponent(companyId)}&mode=ArtList&maxrecords=50&format=json&timespan=12m`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return null
      const json = (await res.json()) as {
        articles?: { seendate?: string; title?: string; domain?: string; tone?: number }[]
      }
      const articles = json.articles ?? []
      if (articles.length === 0) return null

      const sentiment: SentimentItem[] = articles
        .filter((a) => a.seendate && a.title)
        .map((a) => ({
          date: `${a.seendate!.slice(0, 4)}-${a.seendate!.slice(4, 6)}-${a.seendate!.slice(6, 8)}`,
          tone: clampTone(typeof a.tone === 'number' ? a.tone : 0),
          headline: a.title!,
          source: a.domain ?? 'GDELT',
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return { sentiment }
    } catch {
      return null
    }
  },
}
