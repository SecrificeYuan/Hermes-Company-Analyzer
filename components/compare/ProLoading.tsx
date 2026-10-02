// components/compare/ProLoading.tsx
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

const PHASES = ['拉取财务快照…', '比对风险指标…', '生成对比矩阵…']

/** PRO 对战加载：金融终端风格的扫描线 + 骨架屏 */
export function ProLoading() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 1600)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="mt-6 space-y-6">
      {/* 扫描进度条 */}
      <div className="rounded-card border border-[#4C8DFF]/30 bg-ink-card px-5 py-4">
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
          <span>LOADING DATA</span>
          <motion.span
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[#4C8DFF]"
          >
            {PHASES[phase]}
          </motion.span>
        </div>
        <div className="relative h-1 overflow-hidden rounded-full bg-ink-bg">
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-[#4C8DFF]"
            animate={{ x: ['-100%', '320%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  )
}
