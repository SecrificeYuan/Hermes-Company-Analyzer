'use client'

import { motion } from 'framer-motion'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

const DIMS: Record<Exclude<NarrativeKey, 'network'>, { score: (x: CompanyXRay) => number; sub: (x: CompanyXRay) => string }> = {
  hp: { score: (x) => x.hp.score, sub: (x) => `质押 ${x.def.pledgeRatio}%` },
  def: { score: (x) => x.def.score, sub: (x) => `质押 ${x.def.pledgeRatio}%` },
  atk: { score: (x) => x.atk.score, sub: (x) => `${x.atk.lawsuitCount} 起` },
  morale: { score: (x) => x.morale.score, sub: (x) => `tone ${x.morale.avgTone}` },
}

/** LITE 速览层迷你维度卡：标签 + 分数条 + 一行小字 */
export function MiniDimCard({ id, k, xray }: { id: string; k: NarrativeKey; xray: CompanyXRay }) {
  const t = useTokens()
  const terms = getTerms('lite')
  if (k === 'network') return null
  const unavailable = (k === 'morale' && xray.morale.available === false) || (k === 'atk' && xray.atk.available === false)
  if (unavailable) {
    return (
      <section id={id} className="glass-card scroll-mt-24 p-4">
        <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
          <span className="tracking-wider text-slate-400">{terms.dimensionTitles[k]}</span>
          <span className="text-slate-500">{k === 'atk' ? '司法数据暂未接入' : '东方财富新闻加载中'}</span>
        </div>
        <div className="h-1.5 border border-dashed border-edge" />
      </section>
    )
  }
  const dim = DIMS[k]
  const score = dim.score(xray)
  const color = scoreColor(t, score)

  return (
    <section id={id} className="glass-card scroll-mt-24 p-4">
      <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
        <span className="tracking-wider text-slate-400">{terms.dimensionTitles[k]}</span>
        <span style={{ color }}>{dim.sub(xray)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-ink-bg/80">
        <motion.div
          className="h-full rounded"
          style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </section>
  )
}
