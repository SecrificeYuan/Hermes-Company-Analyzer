'use client'

import { motion } from 'framer-motion'
import { HealthBar } from './HealthBar'
import { HiddenStatusList } from './HiddenStatusList'
import { StatNumber } from './StatNumber'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

function DimRow({ label, score, sub }: { label: string; score: number; sub: string }) {
  const t = useTokens()
  const color = scoreColor(t, score)
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
        <span className="tracking-wider text-slate-400">{label}</span>
        <span style={{ color }}>{sub}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-ink-bg/80">
        <motion.div
          className="h-full rounded"
          style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
        />
      </div>
    </div>
  )
}

/** PRO：健康度环形仪表 + 2×2 指标网格（无血条、无霓虹） */
function ProCard({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const terms = getTerms('pro')
  const color = scoreColor(t, xray.hp.score)
  const metrics: { label: string; score: number; sub: string }[] = [
    { label: terms.defLabel, score: xray.def.score, sub: `${xray.def.label} · 质押 ${xray.def.pledgeRatio}%` },
    { label: terms.atkLabel, score: xray.atk.score, sub: `诉讼 ${xray.atk.lawsuitCount} 起 / 被执行 ${formatWan(xray.atk.executionAmount)}` },
    { label: '现金流强度', score: xray.hp.score, sub: `经营现金流 ${formatWan(xray.hp.cashFlow)}` },
    { label: terms.moraleLabel, score: xray.morale.score, sub: `avgTone ${xray.morale.avgTone}` },
  ]

  return (
    <div className="glass-card flex h-full flex-col gap-5 p-6">
      <div className="flex items-center gap-4">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${color} 0 ${xray.hp.score * 3.6}deg, ${t.colors.edge} ${xray.hp.score * 3.6}deg 360deg)` }}
        >
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-ink-card">
            <StatNumber value={xray.hp.score} className="text-xl font-semibold text-slate-50" duration={1.2} />
            <span className="font-mono text-[9px] tracking-wider text-slate-500">健康度</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-slate-50">{xray.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {xray.stockCode ?? 'UNLISTED'} · {xray.industry}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="font-mono text-[10px] tracking-wider text-slate-500">{m.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold" style={{ color: scoreColor(t, m.score) }}>
              <StatNumber value={m.score} duration={1} />
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-1">
        <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
          {terms.hiddenTitle}
          <span className="text-grape">
            ×<StatNumber value={xray.hiddenStatus.length} duration={0.6} />
          </span>
        </div>
        <HiddenStatusList items={xray.hiddenStatus} />
      </div>
    </div>
  )
}

/** 角色卡主容器：LITE = 游戏风（头像 + HP 血条 + DEF/ATK/士气）；PRO = 终端仪表 */
export function CharacterCard({ xray }: { xray: CompanyXRay }) {
  const mode = useMode()
  const terms = getTerms(mode)

  if (mode === 'pro') return <ProCard xray={xray} />

  return (
    <div className="glass-card flex h-full flex-col gap-5 p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card border border-neon/30 bg-neon/5 text-2xl font-bold text-neon shadow-glow">
          {xray.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-slate-50">{xray.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {xray.stockCode ?? 'UNLISTED'} · {xray.industry}
          </div>
        </div>
      </div>

      <HealthBar hp={xray.hp} />

      <div className="space-y-3">
        <DimRow label={terms.defLabel} score={xray.def.score} sub={`${xray.def.label} · 质押 ${xray.def.pledgeRatio}%`} />
        <DimRow
          label={terms.atkLabel}
          score={xray.atk.score}
          sub={`${xray.atk.label} · 诉讼 ${xray.atk.lawsuitCount} 起 / 被执行 ${formatWan(xray.atk.executionAmount)}`}
        />
        <DimRow label={terms.moraleLabel} score={xray.morale.score} sub={`${xray.morale.label} · tone ${xray.morale.avgTone}`} />
      </div>

      <div className="mt-1">
        <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
          {terms.hiddenTitle}
          <span className="text-grape">
            ×<StatNumber value={xray.hiddenStatus.length} duration={0.6} />
          </span>
        </div>
        <HiddenStatusList items={xray.hiddenStatus} />
      </div>
    </div>
  )
}
