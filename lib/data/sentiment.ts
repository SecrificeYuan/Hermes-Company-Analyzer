import { scoreMorale } from '@/lib/analysis/scoring/morale'
import type { SentimentSnapshot } from '@/lib/types'
import { fetchEastmoneyNews } from './adapters/eastmoney-sentiment'

const TTL_MS = 3 * 60 * 1000
const DEADLINE_MS = 14_000

const cache = new Map<string, { value: SentimentSnapshot; expiresAt: number }>()
const inFlight = new Map<string, Promise<SentimentSnapshot>>()

function cacheKey(companyId: string, page: number): string {
  return `${companyId}:${page}`
}

async function fetchSnapshot(companyId: string, page: number): Promise<SentimentSnapshot> {
  const fetchedAt = new Date().toISOString()
  try {
    const news = await fetchEastmoneyNews(companyId, page, AbortSignal.timeout(DEADLINE_MS))
    if (news.items.length === 0) {
      return {
        companyId, status: 'unavailable', source: '东方财富新闻', fetchedAt, items: [],
        page, hasMore: news.hasMore, totalHits: news.totalHits, loadedPages: page,
        message: page === 1 ? '未找到可验证的相关新闻。' : '未找到更多相关新闻。',
      }
    }
    return {
      companyId,
      status: 'available',
      source: '东方财富新闻',
      fetchedAt,
      items: news.items,
      coverage: news.coverage,
      page,
      hasMore: news.hasMore,
      totalHits: news.totalHits,
      historyStatus: news.hasMore ? 'recent' : 'complete',
      loadedPages: page,
      morale: scoreMorale(news.items, new Date()),
    }
  } catch {
    return {
      companyId, status: 'failed', source: '东方财富新闻', fetchedAt, items: [], page, loadedPages: page,
      message: '东方财富新闻暂不可用，请稍后重试。',
    }
  }
}

/** 独立舆情请求的短 TTL 缓存与并发合并，避免同一公司被重复抓取。 */
export async function getSentimentSnapshot(companyId: string, page = 1): Promise<SentimentSnapshot> {
  const key = cacheKey(companyId, page)
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  const running = inFlight.get(key)
  if (running) return running

  const request = fetchSnapshot(companyId, page).then((value) => {
    // 上游故障不缓存，下一次用户操作可立即重试。
    if (value.status !== 'failed') cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
    return value
  }).finally(() => inFlight.delete(key))
  inFlight.set(key, request)
  return request
}
