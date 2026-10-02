'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CompanyXRay, Severity, TimelineEvent } from '@/lib/types'

const SEV_COLOR: Record<Severity, string> = { high: '#FF3B5C', mid: '#FFB020', low: '#00E5FF' }
const CATEGORY_NAME: Record<TimelineEvent['category'], string> = {
  finance: '财务',
  legal: '司法',
  people: '人事',
  sentiment: '舆情',
}

/** 横向风险时间轴（可滚动）：颜色 = severity，倒序（最新在左） */
export function RiskTimeline({ timeline }: { timeline: CompanyXRay['timeline'] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollBy = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' })

  if (timeline.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-700/60 font-mono text-xs text-slate-500">
        ░ 近 12 个月无显著风险事件 ░
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute right-0 top-0 z-10 flex gap-1.5">
        <button onClick={() => scrollBy(-320)} className="rounded-btn border border-neon/20 bg-ink-card p-1 text-neon hover:border-neon/60" aria-label="向左滚动">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={() => scrollBy(320)} className="rounded-btn border border-neon/20 bg-ink-card p-1 text-neon hover:border-neon/60" aria-label="向右滚动">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-2 pt-8">
        <div className="relative flex min-w-max gap-0 px-2">
          {/* 水平主线 */}
          <div className="absolute left-0 right-0 top-[26px] h-px bg-gradient-to-r from-neon/40 via-neon/15 to-transparent" />
          {timeline.map((t, i) => {
            const color = SEV_COLOR[t.severity]
            return (
              <motion.div
                key={`${t.date}-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + Math.min(i, 12) * 0.04 }}
                className="w-52 shrink-0 pr-5"
              >
                <div className="font-mono text-[10px] tracking-wider text-slate-500">{t.date}</div>
                <div className="relative my-2 h-3">
                  <span
                    className="absolute left-0 top-0 h-3 w-3 rounded-full border-2"
                    style={{ borderColor: color, background: `${color}33`, boxShadow: `0 0 10px ${color}88` }}
                  />
                </div>
                <div className="mb-1 font-mono text-[10px]" style={{ color }}>
                  {CATEGORY_NAME[t.category]} · {t.severity.toUpperCase()}
                </div>
                <p className="line-clamp-3 text-xs leading-relaxed text-slate-300">{t.event}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
