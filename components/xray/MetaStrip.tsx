'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataSourceBadge } from './DataSourceBadge'
import { StatNumber } from './StatNumber'
import { formatWan } from '@/lib/utils'
import { useTencentQuote } from '@/lib/hooks/use-tencent-quote'
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

/** PRO 元信息条：工商 key-value + 评级 + 健康度环 + 诊断摘要（规格 §3.2） */
export function MetaStrip({ xray, health }: { xray: CompanyXRay; health?: CompanyHealth }) {
  const meta = RISK_META[xray.overallRisk]
  const t = useTokens()
  const terms = getTerms('pro')
  const color = t.riskColor[xray.overallRisk]
  const r = xray.registry
  const quote = useTencentQuote(health ? undefined : xray.stockCode)
  const quoteColor = quote && quote.change > 0 ? t.colors.danger : quote && quote.change < 0 ? t.colors.safe : t.colors.textDim

  const kv: { k: string; v: string }[] = [
    ...(r ? [{ k: terms.metaStrip.creditCode, v: r.creditCode }] : health?.company.creditCode ? [{ k: '信用代码线索', v: health.company.creditCode }] : []),
    { k: '所属行业', v: xray.industry },
    ...(r ? [{ k: terms.metaStrip.foundedAt, v: r.foundedAt }] : health?.company.foundedAt ? [{ k: terms.metaStrip.foundedAt, v: health.company.foundedAt }] : []),
    ...(r ? [{ k: terms.metaStrip.registeredCapital, v: formatWan(r.registeredCapital) }] : []),
    { k: terms.metaStrip.asOf, v: xray.asOf.replace('T', ' ').slice(0, 16) },
  ]

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
      style={health ? undefined : { borderColor: `${color}66` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-50">{r?.fullName ?? xray.name}</h1>
            <span className="font-mono text-xs text-slate-500">
              {health ? listingLabels[health.company.listing] : xray.stockCode ?? 'UNLISTED'} · {xray.industry}
            </span>
            <Badge variant={health ? 'warn' : meta.badge} className="gap-1.5 px-3 py-1 text-xs">
              <meta.Icon className="h-3.5 w-3.5" />
              {health ? '健康度待评估' : meta.label}
            </Badge>
            {quote && (
              <span className="inline-flex items-center gap-2 rounded-btn border border-edge bg-ink-card px-3 py-1 font-mono text-xs">
                <span className="text-sm font-semibold" style={{ color: quoteColor }}>{quote.price.toFixed(2)}</span>
                <span className="inline-flex items-center gap-0.5" style={{ color: quoteColor }}>
                  {quote.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
                </span>
                <span className="text-slate-500">
                  高 {quote.high.toFixed(2)} / 低 {quote.low.toFixed(2)}
                </span>
                {quote.totalCapYi !== null && <span className="text-slate-500">市值 {quote.totalCapYi.toFixed(0)}亿</span>}
                {quote.time && <span className="text-slate-600">{quote.time}</span>}
              </span>
            )}
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
            {health ? <p className="text-xs text-slate-500">公开来源 {health.sources.length} 条 · 详情见证据溯源</p> : <DataSourceBadge sources={xray.sources} />}
          </div>
        </div>

        {!health && <div className="flex items-center gap-5">
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
        </div>}
      </div>
    </motion.header>
  )
}
