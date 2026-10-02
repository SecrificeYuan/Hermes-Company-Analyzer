'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataSourceBadge } from './DataSourceBadge'
import { StatNumber } from './StatNumber'
import { riskColor } from '@/lib/theme/tokens'
import type { CompanyXRay } from '@/lib/types'

const RISK_META = {
  green: { label: '低风险 · GREEN', Icon: ShieldCheck, badge: 'safe' as const },
  yellow: { label: '中风险 · YELLOW', Icon: AlertTriangle, badge: 'warn' as const },
  red: { label: '高风险 · RED', Icon: ShieldAlert, badge: 'danger' as const },
}

/** 一句话诊断横幅：报告页的"标题党"，3 秒定调 */
export function VerdictBanner({ xray }: { xray: CompanyXRay }) {
  const meta = RISK_META[xray.overallRisk]
  const color = riskColor[xray.overallRisk]

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card relative overflow-hidden p-6"
      style={{ borderColor: `${color}66` }}
    >
      {/* 顶部霓虹扫描线：视觉记忆点 */}
      <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
        <div className="animate-scanline h-full w-1/3 bg-gradient-to-r from-transparent via-neon to-transparent" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-50">{xray.name}</h1>
            <span className="font-mono text-xs text-slate-500">
              {xray.stockCode} · {xray.industry}
            </span>
          </div>
          <p className="max-w-3xl text-base leading-relaxed text-slate-200">{xray.verdict}</p>
          <p className="mt-2 text-sm text-slate-400">
            <span className="font-mono text-[11px] tracking-wider text-neon/80">ADVICE </span>
            {xray.advice}
          </p>
          <div className="mt-4">
            <DataSourceBadge sources={xray.sources} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge variant={meta.badge} className="gap-1.5 px-3 py-1 text-xs">
            <meta.Icon className="h-3.5 w-3.5" />
            {meta.label}
          </Badge>
          <div className="text-right">
            <StatNumber value={xray.riskScore} className="text-5xl font-bold" duration={1.5} />
            <div className="font-mono text-[10px] tracking-[0.3em] text-slate-500">RISK SCORE</div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
