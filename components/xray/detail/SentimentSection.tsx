'use client'
import { SentimentCurve } from '../SentimentCurve'
import { DetailTable } from './DataTable'
import type { CompanyXRay, SentimentSnapshot } from '@/lib/types'

function toneColor(tone: number): string {
  if (tone >= 3) return 'text-safe'
  if (tone <= -3) return 'text-danger'
  return 'text-slate-400'
}

function historyText(snapshot: SentimentSnapshot): string | null {
  switch (snapshot.historyStatus) {
    case 'backfilling': return `年度历史回补中 · 已加载 ${snapshot.loadedPages ?? 1} 页 / ${snapshot.items.length} 条`
    case 'complete': return `年度历史已完成 · 已加载 ${snapshot.loadedPages ?? 1} 页 / ${snapshot.items.length} 条`
    case 'partial': return `年度历史部分完成 · 已加载 ${snapshot.loadedPages ?? 1} 页 / ${snapshot.items.length} 条`
    case 'limited': return `年度历史达到安全上限 · 已加载 ${snapshot.items.length} 条`
    default: return null
  }
}

export function SentimentSection({
  xray,
  snapshot,
  loading = false,
  slow = false,
}: {
  xray: CompanyXRay
  snapshot?: SentimentSnapshot
  loading?: boolean
  slow?: boolean
}) {
  const items = [...(xray.detail?.sentimentItems ?? [])].reverse() // 最新在前
  const pos = items.filter((i) => i.tone > 0).length
  const neg = items.filter((i) => i.tone < 0).length
  const mid = items.length - pos - neg
  const pct = (n: number) => (items.length ? (n / items.length) * 100 : 0)
  return (
    <div className="space-y-6">
      <SentimentCurve morale={xray.morale} height={240} loading={loading} slow={slow} message={snapshot?.message} />
      {!loading && snapshot && (
        <div className="rounded-btn border border-edge bg-ink-bg/40 px-3 py-2 font-mono text-[11px] text-slate-500">
          来源：{snapshot.source} · 获取时间：{snapshot.fetchedAt.slice(0, 16).replace('T', ' ')}
          {snapshot.coverage && ` · 覆盖：${snapshot.coverage.from} 至 ${snapshot.coverage.to}`}
          {historyText(snapshot) && ` · ${historyText(snapshot)}`}
          {snapshot.status === 'available' && ' · 标题与摘要关键词初筛，需结合原文核查'}
        </div>
      )}
      {items.length > 0 && (
        <div>
          <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-500">
            <span className="text-safe">利好 {pct(pos).toFixed(0)}%</span>
            <span>中性 {pct(mid).toFixed(0)}%</span>
            <span className="text-danger">利空 {pct(neg).toFixed(0)}%</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full">
            <div className="bg-safe/70" style={{ width: `${pct(pos)}%` }} />
            <div className="bg-slate-600/60" style={{ width: `${pct(mid)}%` }} />
            <div className="bg-danger/70" style={{ width: `${pct(neg)}%` }} />
          </div>
        </div>
      )}
      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">舆情事件</h4>
        <DetailTable
          rows={items}
          rowKey={(i) => `${i.date}-${i.headline}`}
          maxRows={10}
          columns={[
            { key: 'date', label: '日期', render: (i) => i.date.slice(0, 10) },
            {
              key: 'tone', label: '倾向', render: (i) => (
                <span className={`inline-block w-8 text-right font-semibold ${toneColor(i.tone)}`}>
                  {i.tone > 0 ? `+${i.tone}` : i.tone}
                </span>
              ),
            },
            {
              key: 'headline', label: '标题', render: (i) => i.url ? (
                <a className="text-neon hover:underline" href={i.url} target="_blank" rel="noreferrer">{i.headline}</a>
              ) : <span className="text-slate-300">{i.headline}</span>,
            },
            { key: 'source', label: '来源', render: (i) => <span className="text-slate-500">{i.source}</span> },
          ]}
          empty={loading ? '░ 正在加载东方财富新闻' : snapshot?.message ?? '░ 舆情暂无法判断'}
        />
      </div>
    </div>
  )
}
