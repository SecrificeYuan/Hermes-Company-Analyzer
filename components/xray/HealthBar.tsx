'use client'

import { motion } from 'framer-motion'
import { StatNumber } from './StatNumber'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

/**
 * HP 血条：从 0 平滑增长；低于 30% 时边框呼吸闪烁红光。
 */
export function HealthBar({ hp }: { hp: CompanyXRay['hp'] }) {
  const t = useTokens()
  const color = scoreColor(t, hp.score)
  const critical = hp.score < 30

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between font-mono">
        <span className="text-xs tracking-wider text-slate-400">HP · 财务血量</span>
        <span className="text-xs" style={{ color }}>{hp.label}</span>
      </div>
      <div
        className={`relative h-5 overflow-hidden rounded-lg border bg-ink-bg/80 ${critical ? 'animate-breathe border-danger/70' : 'border-neon/20'}`}
      >
        <motion.div
          className="h-full rounded-r-sm"
          style={{
            background: `linear-gradient(90deg, ${color}44, ${color})`,
            boxShadow: `0 0 12px ${color}88`,
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${hp.score}%` }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <StatNumber value={hp.score} suffix="/ 100" className="text-xs font-bold text-slate-100" duration={1.4} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-400">
        <div>
          经营现金流 <span className={hp.cashFlow < 0 ? 'text-danger' : 'text-safe'}>{formatWan(hp.cashFlow)}</span>
        </div>
        <div className="text-right">
          资产负债率 <span className={hp.debtRatio > 70 ? 'text-danger' : 'text-slate-200'}>{hp.debtRatio}%</span>
        </div>
      </div>
    </div>
  )
}
