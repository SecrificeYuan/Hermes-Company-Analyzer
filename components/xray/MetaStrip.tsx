'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataSourceBadge } from './DataSourceBadge'
import { StatNumber } from './StatNumber'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

const RISK_META = {
  green: { label: '低风险 · GREEN', Icon: ShieldCheck, badge: 'safe' as const },
  yellow: { label: '中风险 · YELLOW', Icon: AlertTriangle, badge: 'warn' as const },
  red: { label: '高风险 · RED', Icon: ShieldAlert, badge: 'danger' as const },
}

/** PRO 元信息条：工商 key-value + 评级 + 健康度环 + 诊断摘要（规格 §3.2） */
export function MetaStrip({ xray }: { xray: CompanyXRay }) {
  const meta = RISK_META[xray.overallRisk]
  const t = useTokens()
  const terms = getTerms('pro')
  const color = t.riskColor[xray.overallRisk]
  const r = xray.registry

  const kv: { k: string; v: string }[] = [
    ...(r ? [{ k: terms.metaStrip.creditCode, v: r.creditCode }] : []),
    { k: '所属行业', v: xray.industry },
    ...(r ? [{ k: terms.metaStrip.foundedAt, v: r.foundedAt }] : []),
    ...(r ? [{ k: terms.metaStrip.registeredCapital, v: formatWan(r.registeredCapital) }] : []),
    { k: terms.metaStrip.asOf, v: xray.asOf.replace('T', ' ').slice(0, 16) },
  ]

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
      style={{ borderColor: `${color}66` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-50">{r?.fullName ?? xray.name}</h1>
            <span className="font-mono text-xs text-slate-500">
              {xray.stockCode ?? 'UNLISTED'} · {xray.industry}
            </span>
            <Badge variant={meta.badge} className="gap-1.5 px-3 py-1 text-xs">
              <meta.Icon className="h-3.5 w-3.5" />
              {meta.label}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-3">
            {kv.map(({ k, v }) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-1.5">
                <dt className="shrink-0 font-mono text-[10px] tracking-wider text-slate-500">{k}</dt>
                <dd className="truncate font-mono text-xs text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">{xray.verdict}</p>
          <p className="mt-1.5 text-xs text-slate-400">
            <span className="font-mono text-[10px] tracking-wider text-slate-500">ADVICE </span>
            {xray.advice}
          </p>
          <div className="mt-3">
            <DataSourceBadge sources={xray.sources} />
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${color} 0 ${xray.hp.score * 3.6}deg, ${t.colors.edge} ${xray.hp.score * 3.6}deg 360deg)` }}
          >
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-ink-card">
              <StatNumber value={xray.hp.score} className="text-2xl font-semibold text-slate-50" duration={1.2} />
              <span className="font-mono text-[9px] tracking-wider text-slate-500">{terms.healthLabel}</span>
            </div>
          </div>
          <div className="text-right" style={{ color }}>
            <StatNumber value={xray.riskScore} className="text-5xl font-bold" duration={1.5} />
            <div className="font-mono text-[10px] tracking-[0.3em] text-slate-500">{terms.riskScoreCaption}</div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
