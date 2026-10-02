'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useXrayStore } from '@/lib/store'

const SEV_VARIANT = { high: 'danger', mid: 'warn', low: 'dim' } as const

/** 证据卡抽屉：点击隐藏状态后从右侧滑出，逐条列出来源/日期/细节 */
export function EvidenceDrawer() {
  const { activeStatus, setActiveStatus } = useXrayStore()

  return (
    <AnimatePresence>
      {activeStatus && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveStatus(null)}
            className="fixed inset-0 z-40 bg-ink-bg/70 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-neon/20 bg-ink-bg/95 p-6 backdrop-blur-xl"
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-50">{activeStatus.label}</h2>
                  <Badge variant={SEV_VARIANT[activeStatus.severity]}>{activeStatus.severity.toUpperCase()}</Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{activeStatus.description}</p>
              </div>
              <button
                onClick={() => setActiveStatus(null)}
                className="rounded-btn border border-slate-700 p-1.5 text-slate-400 transition-colors hover:border-neon/50 hover:text-neon"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 mt-5 font-mono text-[11px] tracking-[0.3em] text-neon/70">
              EVIDENCE × {activeStatus.evidence.length}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {activeStatus.evidence.map((e, i) => (
                <motion.div
                  key={`${e.date}-${i}`}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.05 }}
                  className="glass-card p-4"
                >
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-neon">{e.source}</span>
                    <span className="text-slate-500">{e.date}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">{e.detail}</p>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-neon/80 hover:text-neon"
                    >
                      查看原文 <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
