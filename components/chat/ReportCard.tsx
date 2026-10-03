'use client'

import Link from 'next/link'

export interface ReportCardData {
  reportId: string
  name: string
  overallRisk: 'green' | 'yellow' | 'red'
  verdict: string
  debuffItems?: { id: string; label: string; severity: string; description: string }[]
  asOf: string
  scenario?: string
}

const LIGHT: Record<string, { emoji: string; name: string }> = {
  green: { emoji: '🟢', name: '绿灯' },
  yellow: { emoji: '🟡', name: '黄灯' },
  red: { emoji: '🔴', name: '红灯' },
}

/** 对话流内的迷你报告卡：克制信息层级，只给结论与行动项 */
export function ReportCard({ card }: { card: ReportCardData }) {
  const light = LIGHT[card.overallRisk] ?? LIGHT.yellow
  const debuffItems = Array.isArray(card.debuffItems) ? card.debuffItems : []

  return (
    <div className="glass-card w-full max-w-md px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span aria-hidden>{light.emoji}</span>
        <span className="font-medium text-slate-100">{card.name}</span>
        <span className="font-mono text-xs text-slate-500">
          {light.name} · 资料截至 {card.asOf}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-300">{card.verdict}</p>

      {debuffItems.length > 0 && (
        <div className="mt-3 space-y-2">
          {debuffItems.map((d) => (
            <div key={d.id} className="rounded-btn bg-black/30 px-3 py-2 text-xs leading-relaxed text-slate-300">
              <span className="font-semibold text-slate-100">{d.label}</span>
              <span className="text-slate-400"> — {d.description}</span>
            </div>
          ))}
        </div>
      )}

      <Link
        href={`/report/${card.reportId}`}
        className="mt-4 inline-block font-mono text-xs text-neon hover:underline"
      >
        完整 X 光与证据链 →
      </Link>
    </div>
  )
}
