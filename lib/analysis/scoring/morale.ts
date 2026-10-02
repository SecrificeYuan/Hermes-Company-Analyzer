import type { CompanyXRay, RawCompanyData, SentimentItem } from '@/lib/types'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

const DAY_MS = 24 * 3600 * 1000

/**
 * 士气 = 近 90 天舆情 tone 均值（-10~10）映射到 0-100。
 * trend 为近 12 个月的月均 tone（原始 -10~10，供 SentimentCurve 以 0 为中线绘图）。
 */
export function scoreMorale(
  sentiment: RawCompanyData['sentiment'],
  asOf: Date,
): CompanyXRay['morale'] {
  const items = sentiment ?? []
  if (items.length === 0) {
    return { score: 50, label: '数据不足', avgTone: 0, trend: [] }
  }

  const recent = items.filter((s) => asOf.getTime() - new Date(s.date).getTime() <= 90 * DAY_MS)
  const pool = recent.length > 0 ? recent : items.slice(-3)
  const avgTone = Math.round((pool.reduce((s, x) => s + x.tone, 0) / pool.length) * 10) / 10
  const score = Math.round(clamp(((avgTone + 10) / 20) * 100))

  // 近 12 个月月均 tone（升序，缺月跳过）
  const byMonth = new Map<string, { sum: number; n: number }>()
  for (const s of items) {
    const month = s.date.slice(0, 7)
    const acc = byMonth.get(month) ?? { sum: 0, n: 0 }
    acc.sum += s.tone
    acc.n += 1
    byMonth.set(month, acc)
  }
  const monthly = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  const trend = monthly.map(([, v]) => Math.round((v.sum / v.n) * 10) / 10)
  const labels = monthly.map(([m]) => m)

  const label = score >= 70 ? '士气高涨' : score >= 50 ? '军心稳定' : score >= 30 ? '流言四起' : '人心惶惶'

  return { score, label, avgTone, trend, labels }
}
