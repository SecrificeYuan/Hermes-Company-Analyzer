'use client'

import { motion } from 'framer-motion'
import { HealthBar } from './HealthBar'
import { HiddenStatusList } from './HiddenStatusList'
import { StatNumber } from './StatNumber'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme/tokens'
import type { CompanyXRay } from '@/lib/types'

function DimRow({ label, score, sub }: { label: string; score: number; sub: string }) {
  const color = scoreColor(score)
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

/** 角色卡主容器：头像位 + HP 血条 + DEF/ATK/士气 + 隐藏状态列表 */
export function CharacterCard({ xray }: { xray: CompanyXRay }) {
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
        <DimRow label="DEF · 护甲" score={xray.def.score} sub={`${xray.def.label} · 质押 ${xray.def.pledgeRatio}%`} />
        <DimRow
          label="ATK · 涉诉攻击"
          score={xray.atk.score}
          sub={`${xray.atk.label} · 诉讼 ${xray.atk.lawsuitCount} 起 / 被执行 ${formatWan(xray.atk.executionAmount)}`}
        />
        <DimRow label="士气 · 舆情" score={xray.morale.score} sub={`${xray.morale.label} · tone ${xray.morale.avgTone}`} />
      </div>

      <div className="mt-1">
        <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
          HIDDEN STATUS
          <span className="text-grape">
            ×<StatNumber value={xray.hiddenStatus.length} duration={0.6} />
          </span>
        </div>
        <HiddenStatusList items={xray.hiddenStatus} />
      </div>
    </div>
  )
}
