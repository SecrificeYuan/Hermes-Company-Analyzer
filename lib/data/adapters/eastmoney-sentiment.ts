import type { SentimentItem } from '@/lib/types'
import { sourceDate } from '../eastmoney'

const EASTMONEY_NEWS_URL = 'https://search-api-web.eastmoney.com/search/jsonp'
export const EASTMONEY_NEWS_PAGE_SIZE = 30

interface EastmoneyArticle {
  date?: unknown
  title?: unknown
  content?: unknown
  mediaName?: unknown
  url?: unknown
}

interface EastmoneySearchResponse {
  code?: unknown
  hitsTotal?: unknown
  result?: { cmsArticleWebOld?: EastmoneyArticle[] }
}

export interface EastmoneyNewsResult {
  items: SentimentItem[]
  coverage?: { from: string; to: string }
  totalHits: number
  hasMore: boolean
}

/** 去除 JSONP 包装后解析东方财富搜索接口的有效负载。 */
export function parseJsonp(payload: string): unknown {
  const trimmed = payload.trim()
  const start = trimmed.indexOf('(')
  const end = trimmed.lastIndexOf(')')
  if (start < 1 || end <= start) throw new Error('INVALID_JSONP')
  return JSON.parse(trimmed.slice(start + 1, end))
}

const POSITIVE_TERMS = [
  '增长', '增幅', '创新高', '上调', '增持', '买入', '回购', '分红', '获批', '中标', '盈利', '净利', '业绩预增', '同比增',
]
const NEGATIVE_TERMS = [
  '处罚', '罚款', '被罚', '警告', '违规', '调查', '立案', '诉讼', '被执行', '失信', '亏损', '下滑', '减持', '质押', '逾期',
  '风险', '暴雷', '跌停', '裁员', '欠薪', '停工', '造假', '问询', '整改',
]

/**
 * 可审计的初筛规则。它只对新闻标题和摘要中的金融风险词计数，不能等同于
 * FinNLP 模型或人工判断，因此调用方必须展示原始报道入口。
 */
export function scoreNewsTone(title: string, summary = ''): number {
  const text = `${title} ${summary}`.toLowerCase()
  const positive = POSITIVE_TERMS.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0)
  const negative = NEGATIVE_TERMS.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0)
  return Math.max(-10, Math.min(10, (positive - negative) * 3))
}

/** 将东方财富的新闻搜索结果转换为可追溯的舆情切片。 */
export function mergeSentimentItems(...groups: SentimentItem[][]): SentimentItem[] {
  const seen = new Set<string>()
  const merged: SentimentItem[] = []
  for (const item of groups.flat()) {
    const key = `${item.date}|${item.headline}|${item.url ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date))
}

export function parseEastmoneyNews(payload: unknown, page = 1): EastmoneyNewsResult {
  const response = payload as EastmoneySearchResponse
  if (response?.code !== undefined && response.code !== 0 && response.code !== '0') {
    throw new Error('EASTMONEY_NEWS_RESPONSE_ERROR')
  }
  const rows = response?.result?.cmsArticleWebOld
  const totalHits = typeof response?.hitsTotal === 'number' && Number.isFinite(response.hitsTotal)
    ? response.hitsTotal
    : 0
  if (!Array.isArray(rows)) return { items: [], totalHits, hasMore: false }

  const seen = new Set<string>()
  const items: SentimentItem[] = []
  for (const row of rows) {
    const date = sourceDate(row.date)
    const headline = typeof row.title === 'string' ? row.title.replace(/<[^>]+>/g, '').trim() : ''
    if (!date || !headline) continue
    const url = typeof row.url === 'string' && /^https?:\/\//.test(row.url) ? row.url : undefined
    const key = `${date}|${headline}|${url ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    const summary = typeof row.content === 'string' ? row.content.replace(/<[^>]+>/g, '').trim() : ''
    items.push({
      date,
      tone: scoreNewsTone(headline, summary),
      headline,
      source: typeof row.mediaName === 'string' && row.mediaName.trim() ? row.mediaName.trim() : '东方财富新闻',
      url,
    })
    if (items.length >= EASTMONEY_NEWS_PAGE_SIZE) break
  }

  const sorted = mergeSentimentItems(items)
  return {
    items: sorted,
    totalHits,
    hasMore: rows.length > 0 && page * EASTMONEY_NEWS_PAGE_SIZE < totalHits,
    ...(sorted.length ? { coverage: { from: sorted[0].date, to: sorted[sorted.length - 1].date } } : {}),
  }
}

function buildSearchUrl(companyId: string, page: number): URL {
  const param = {
    uid: '',
    keyword: companyId,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientType: 'web',
    clientVersion: 'curr',
    param: {
      cmsArticleWebOld: {
        searchScope: 'default', sort: 'default', pageIndex: page, pageSize: EASTMONEY_NEWS_PAGE_SIZE, preTag: '', postTag: '',
      },
    },
  }
  const url = new URL(EASTMONEY_NEWS_URL)
  // 该接口会校验 JSONP callback 的浏览器兼容形态，callback 是其稳定接受值。
  url.searchParams.set('cb', 'callback')
  url.searchParams.set('param', JSON.stringify(param))
  return url
}

/**
 * 东方财富个股新闻。数据采集路径与 FinNLP/AKShare 的东方财富新闻源一致，
 * 但不在 Next.js 进程内伪装运行未部署的 FinNLP 模型。
 */
export async function fetchEastmoneyNews(companyId: string, page: number, signal: AbortSignal): Promise<EastmoneyNewsResult> {
  const response = await fetch(buildSearchUrl(companyId, page), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: '*/*',
      Referer: 'https://so.eastmoney.com/',
      Origin: 'https://so.eastmoney.com',
    },
    signal,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`EASTMONEY_NEWS_${response.status}`)
  return parseEastmoneyNews(parseJsonp(await response.text()), page)
}
