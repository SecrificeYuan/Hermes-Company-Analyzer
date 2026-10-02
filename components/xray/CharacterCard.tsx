'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { HealthBar } from './HealthBar'
import { HiddenStatusList } from './HiddenStatusList'
import { StatNumber } from './StatNumber'
import { DataSourceBadge } from './DataSourceBadge'
import { AttributeRadar } from './AttributeRadar'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'
import type { CompanyHealth } from '@/lib/company'
import { listingLabels } from '@/lib/company'

const RISK_META = {
  green: { label: '低风险 · GREEN', Icon: ShieldCheck, badge: 'safe' as const },
  yellow: { label: '中风险 · YELLOW', Icon: AlertTriangle, badge: 'warn' as const },
  red: { label: '高风险 · RED', Icon: ShieldAlert, badge: 'danger' as const },
}

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

/** LITE 角色横幅：头像 + 评级 + HP 血条组 + 诊断 + 小雷达（规格 §3.2） */
export function CharacterCard({ xray, health }: { xray: CompanyXRay; health?: CompanyHealth }) {
  const terms = getTerms('lite')
  const meta = RISK_META[xray.overallRisk]

  return (
    <div className="glass-card flex h-full flex-col gap-5 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card border border-neon/30 bg-neon/5 text-2xl font-bold text-neon shadow-glow">
          {xray.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-slate-50">{xray.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {health ? listingLabels[health.company.listing] : xray.stockCode ?? 'UNLISTED'} · {xray.industry}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={health ? 'warn' : meta.badge} className="gap-1.5 px-2.5 py-0.5 text-[11px]">
              <meta.Icon className="h-3 w-3" />
              {health ? '健康度待评估' : meta.label}
            </Badge>
            {!health && <span className="flex items-baseline gap-1">
              <StatNumber value={xray.riskScore} className="text-xl font-bold text-slate-100" duration={1.2} />
              <span className="font-mono text-[9px] tracking-[0.2em] text-slate-500">{terms.riskScoreCaption}</span>
            </span>}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[13px] leading-relaxed text-slate-200">{xray.verdict}</p>
        <p className="mt-1.5 text-xs text-slate-400">
          <span className="font-mono text-[10px] tracking-wider text-neon/80">ADVICE </span>
          {xray.advice}
        </p>
      </div>

      {health ? <div className="rounded-btn border border-warn/30 px-4 py-3 text-sm text-warn">财务、司法、股权和舆情资料不完整，暂不生成健康分数。</div> : <HealthBar hp={xray.hp} />}

      {!health && <div className="space-y-3">
        <DimRow label={terms.defLabel} score={xray.def.score} sub={`${xray.def.label} · 质押 ${xray.def.pledgeRatio}%`} />
        <DimRow
          label={terms.atkLabel}
          score={xray.atk.score}
          sub={`${xray.atk.label} · 诉讼 ${xray.atk.lawsuitCount} 起 / 被执行 ${formatWan(xray.atk.executionAmount)}`}
        />
        <DimRow label={terms.moraleLabel} score={xray.morale.score} sub={`${xray.morale.label} · tone ${xray.morale.avgTone}`} />
      </div>}

      <div className="mt-auto">
        <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
          {terms.hiddenTitle}
          <span className="text-grape">
            ×<StatNumber value={xray.hiddenStatus.length} duration={0.6} />
          </span>
        </div>
        <HiddenStatusList items={xray.hiddenStatus} />
      </div>

      <div className="border-t border-edge/60 pt-4">
        <div className="mb-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">{terms.cardTitles.radar}</div>
        {health ? <p className="text-xs text-slate-400">资料不足，暂不生成雷达图。</p> : <AttributeRadar xray={xray} height={210} />}
      </div>

      {health ? <p className="text-xs text-slate-500">公开来源 {health.sources.length} 条 · 详情见来源与资料缺口</p> : <DataSourceBadge sources={xray.sources} />}
    </div>
  )
}
