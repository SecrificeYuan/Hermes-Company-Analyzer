import type { Announcement, RawCompanyData, Severity, TimelineEvent } from '@/lib/types'
import { withinDays } from './debuff/detectors'

function announcementSeverity(a: Announcement): Severity {
  switch (a.type) {
    case '诉讼':
      return 'high'
    case '减持':
    case '质押':
    case '问询':
      return 'mid'
    default:
      return 'low'
  }
}

const ANNOUNCEMENT_CATEGORY: Record<Announcement['type'], TimelineEvent['category']> = {
  诉讼: 'legal',
  减持: 'people',
  质押: 'people',
  问询: 'finance',
  年报: 'finance',
  其他: 'finance',
}

/**
 * 风险时间轴：合并公告/司法/人事/舆情四类事件，输出近 12 个月、按日期倒序。
 * 舆情只收录 |tone|>=4 的显著转折点，避免时间轴被日常噪音淹没。
 */
export function buildTimeline(raw: RawCompanyData, asOf: Date): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const a of raw.announcements ?? []) {
    events.push({ date: a.date, event: a.title, category: ANNOUNCEMENT_CATEGORY[a.type], severity: announcementSeverity(a) })
  }

  for (const l of raw.legal?.lawsuits ?? []) {
    events.push({
      date: l.date,
      event: `${l.role} · ${l.cause}（${l.amount} 万元）`,
      category: 'legal',
      severity: l.amount > 10000 ? 'high' : l.amount > 1000 ? 'mid' : 'low',
    })
  }

  for (const e of raw.legal?.executions ?? []) {
    events.push({
      date: e.date,
      event: `被执行 ${e.amount} 万元（${e.status}）`,
      category: 'legal',
      severity: 'high',
    })
  }

  for (const p of raw.people ?? []) {
    const amount = p.amount ? `（${p.event === '质押' ? `${p.amount}%` : `${p.amount} 万元`}）` : ''
    events.push({
      date: p.date,
      event: `${p.name}（${p.role}）${p.event}${amount}`,
      category: 'people',
      severity:
        p.event === '减持' && (p.amount ?? 0) > 1000
          ? 'high'
          : p.event === '质押' && (p.amount ?? 0) >= 70
            ? 'high'
            : p.event === '增持'
              ? 'low'
              : 'mid',
    })
  }

  for (const s of raw.sentiment ?? []) {
    if (Math.abs(s.tone) < 4) continue
    events.push({
      date: s.date,
      event: s.headline,
      category: 'sentiment',
      severity: s.tone <= -7 ? 'high' : s.tone <= -5 ? 'mid' : 'low',
    })
  }

  return events
    .filter((e) => withinDays(e.date, asOf, 365))
    .sort((a, b) => b.date.localeCompare(a.date))
}
