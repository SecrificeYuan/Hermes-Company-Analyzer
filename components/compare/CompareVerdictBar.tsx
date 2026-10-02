// components/compare/CompareVerdictBar.tsx
'use client'

import { Trophy } from 'lucide-react'
import { compareVerdict } from '@/lib/analysis/compare-verdict'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

/**
 * 判定横幅：LITE = 战报风（奖杯 + 发光描边）；PRO = 克制对比条（无动效无发光）。
 * 平局（分差 ≤3）时 LITE 显「势均力敌 · DRAW」，PRO 显「基本一致」。
 */
export function CompareVerdictBar({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode).compare
  const outcome = compareVerdict(a.riskScore, b.riskScore)
  const winner = outcome === 'A' ? a : outcome === 'B' ? b : null

  if (mode === 'pro') {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink-edge bg-ink-card px-6 py-4"
        role="status"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: t.colors.textFaint }}>
            综合对比
          </span>
          <span className="text-base font-semibold" style={{ color: t.colors.textMain }}>
            {winner ? terms.winnerTemplate.replace('{name}', winner.name) : terms.drawLabel}
          </span>
        </div>
        <span className="font-mono text-sm" style={{ color: t.colors.textDim }}>
          {a.name} {a.riskScore} · {b.riskScore} {b.name}
        </span>
      </div>
    )
  }

  const accent = winner ? t.riskColor.green : t.colors.textDim
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 rounded-card border px-6 py-5"
      style={{
        borderColor: `${accent}66`,
        background: `${accent}0D`,
        boxShadow: winner ? `0 0 24px ${accent}33` : undefined,
      }}
      role="status"
    >
      {winner && <Trophy className="h-5 w-5" style={{ color: accent }} />}
      <span className="text-xl font-bold text-slate-50">
        {winner ? terms.winnerTemplate.replace('{name}', winner.name) : `${terms.drawLabel} · DRAW`}
      </span>
      <span className="font-mono text-xs text-slate-400">
        {getTerms(mode).riskScoreCaption} {a.riskScore} : {b.riskScore}
      </span>
    </div>
  )
}
