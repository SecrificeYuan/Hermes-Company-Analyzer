import type { RawCompanyData, SentimentItem } from '@/lib/types'
import type { DataAdapter } from '../adapter'
import { resolveCompany } from '../eastmoney'

interface TonePoint { date?: unknown; value?: unknown }
interface ToneSeries { data?: TonePoint[] }
interface Article { seendate?: unknown; title?: unknown; domain?: unknown }

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value.replace(/-/g, ''))
  if (!match) return null
  const date = `${match[1]}-${match[2]}-${match[3]}`
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}

function clampTone(value: number): number {
  return Math.max(-10, Math.min(10, Math.round(value * 10) / 10))
}

/** Pair real timeline tone with a representative article from the same month. */
export function aggregateGdelt(timeline: unknown, articleList: unknown): SentimentItem[] {
  const series = (timeline as { timeline?: ToneSeries[] })?.timeline
  const articles = (articleList as { articles?: Article[] })?.articles
  if (!Array.isArray(series) || !Array.isArray(articles)) return []

  const titles = new Map<string, { date: string; headline: string; source: string }>()
  for (const article of articles) {
    const date = isoDate(article?.seendate)
    if (!date || typeof article.title !== 'string' || !article.title.trim()) continue
    const month = date.slice(0, 7)
    const previous = titles.get(month)
    if (!previous || date > previous.date) {
      titles.set(month, {
        date,
        headline: article.title.trim(),
        source: typeof article.domain === 'string' && article.domain.trim() ? article.domain.trim() : 'GDELT',
      })
    }
  }

  const tones = new Map<string, { sum: number; count: number }>()
  for (const item of series[0]?.data ?? []) {
    const date = isoDate(item?.date)
    const value = item?.value
    if (!date || typeof value !== 'number' || !Number.isFinite(value)) continue
    const month = date.slice(0, 7)
    const previous = tones.get(month) ?? { sum: 0, count: 0 }
    previous.sum += value
    previous.count++
    tones.set(month, previous)
  }

  return [...tones.entries()]
    .filter(([month]) => titles.has(month))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      ...titles.get(month)!,
      tone: clampTone(values.sum / values.count),
    }))
}

async function queryName(companyId: string): Promise<string | null> {
  const company = await resolveCompany(companyId)
  return company?.name ?? null
}

/** GDELT DOC 2.0: TimelineTone supplies measured tone; ArtList supplies titles. */
export const gdeltAdapter: DataAdapter = {
  name: 'gdelt',
  async fetch(companyId): Promise<Partial<RawCompanyData> | null> {
    try {
      if (process.env.GDELT_ENABLED === 'false') return null
      const name = await queryName(companyId)
      if (!name) return null
      const endpoint = process.env.GDELT_API_URL ?? 'https://api.gdeltproject.org/api/v2/doc/doc'
      const query = `"${name.replace(/["()]/g, ' ').trim()}"`
      const buildUrl = (mode: string) => {
        const url = new URL(endpoint)
        url.search = new URLSearchParams({ query, mode, format: 'json', timespan: '12m', maxrecords: '250' }).toString()
        return url
      }
      const [toneResponse, articleResponse] = await Promise.all([
        fetch(buildUrl('TimelineTone'), { signal: AbortSignal.timeout(8000) }),
        fetch(buildUrl('ArtList'), { signal: AbortSignal.timeout(8000) }),
      ])
      if (!toneResponse.ok || !articleResponse.ok) return null
      const sentiment = aggregateGdelt(await toneResponse.json(), await articleResponse.json())
      return sentiment.length ? { sentiment } : null
    } catch {
      return null
    }
  },
}
