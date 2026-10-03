// components/compare/LiteLoading.tsx
'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Swords } from 'lucide-react'

const PHASES = [
  '正在调取体检档案…',
  '正在拍摄 X 光片…',
  '扫描现金流与股权信号…',
  '比对五维风险，点亮信号灯…',
  '双剑交锋，胜负即将揭晓…',
]

/** 单个对战者卡片：名字 + X 光扫描线 + HP 扫描条 */
function FighterCard({ name, sub, side }: { name: string; sub: string; side: 'A' | 'B' }) {
  const enterX = side === 'A' ? -60 : 60
  const tilt = side === 'A' ? -2.5 : 2.5
  return (
    <motion.div
      initial={{ opacity: 0, x: enterX, rotate: tilt * 2 }}
      animate={{ opacity: 1, x: 0, rotate: tilt }}
      transition={{ type: 'spring', stiffness: 160, damping: 16 }}
      className={`glass-card relative w-full overflow-hidden p-5 shadow-glow ${side === 'A' ? 'origin-right' : 'origin-left'}`}
    >
      {/* X 光扫描线：从上到下的霓虹光带 */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-neon/25 to-transparent"
        animate={{ top: ['-15%', '105%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: side === 'A' ? 0 : 0.75 }}
      />
      <div className="relative">
        <div className="font-mono text-[10px] tracking-[0.3em] text-slate-500">{side} 队</div>
        <div className="mt-1 truncate text-lg font-bold text-slate-100">{name}</div>
        <div className="mt-0.5 font-mono text-[11px] text-slate-500">{sub}</div>
        {/* HP 扫描条 */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-bg/80">
          <motion.div
            className="h-full rounded-full bg-neon"
            animate={{ width: ['4%', '96%', '4%'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: side === 'A' ? 0 : 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  )
}

/** 中央交锋：交叉双剑 + 冲击环 + 火花 */
function Clash() {
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      {/* 扩散冲击环 */}
      {[0, 0.45].map((delay) => (
        <motion.div
          key={delay}
          className="absolute inset-0 rounded-full border-2 border-neon/60"
          animate={{ scale: [0.55, 1.5], opacity: [0.8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay }}
        />
      ))}
      {/* 交锋火花 */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-neon"
            animate={{
              x: [0, Math.cos(angle) * 46],
              y: [0, Math.sin(angle) * 46],
              opacity: [1, 0],
              scale: [1, 0.4],
            }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeOut', delay: i * 0.11 }}
          />
        )
      })}
      {/* 双剑 */}
      <motion.div
        className="relative z-10 rounded-full border border-neon/40 bg-ink-card p-4 text-neon shadow-glow"
        animate={{ rotate: [0, -12, 8, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Swords className="h-7 w-7" />
      </motion.div>
    </div>
  )
}

export function LiteLoading({ aName, bName }: { aName?: string; bName?: string }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 1500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="mt-8 flex flex-col items-center" aria-busy="true" aria-live="polite">
      <div className="flex w-full max-w-3xl items-center gap-3 sm:gap-5">
        <FighterCard name={aName ?? '挑战者 A'} sub="X-RAY IN PROGRESS" side="A" />
        <Clash />
        <FighterCard name={bName ?? '挑战者 B'} sub="X-RAY IN PROGRESS" side="B" />
      </div>

      {/* 底部轮换口播 */}
      <div className="mt-6 h-5">
        <AnimatePresence mode="wait">
          <motion.p
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="text-center font-mono text-xs tracking-widest text-neon"
          >
            {PHASES[phase]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
