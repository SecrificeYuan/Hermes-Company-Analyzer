// components/compare/BattleLoading.tsx
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'

const PHASES = ['锁定对手…', '扫描双方战力…', '调取证据链…', '风险对决判定中…']
const PHASE_MS = 1400

/** LITE 对战加载：双剑交锋趣味动画（PRO 用常规骨架屏） */
export function BattleLoading() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), PHASE_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="glass-card relative mt-6 overflow-hidden p-10">
      {/* 能量冲击波 */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
      >
        <div className="h-64 w-64 rounded-full bg-neon/20 blur-3xl" />
      </motion.div>

      <div className="relative flex flex-col items-center gap-8">
        {/* 交锋台：双方能量体对冲 */}
        <div className="flex items-center gap-10">
          {/* A 方能量体 */}
          <motion.div
            className="flex h-20 w-20 items-center justify-center rounded-2xl border border-neon/50 bg-ink-card shadow-glow"
            animate={{ x: [0, 14, 0], rotate: [0, -4, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="font-mono text-xl font-extrabold text-neon">A</span>
          </motion.div>

          {/* 双剑交锋 */}
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{ rotate: [45, 45, 405], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Swords className="h-10 w-10 text-neon" />
            </motion.div>
            {/* 碰撞闪光 */}
            <motion.div
              className="absolute h-4 w-4 rounded-full bg-slate-100"
              animate={{ opacity: [0, 1, 0], scale: [0.4, 2.4, 0.4] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
            />
          </div>

          {/* B 方能量体 */}
          <motion.div
            className="flex h-20 w-20 items-center justify-center rounded-2xl border border-grape/50 bg-ink-card"
            style={{ boxShadow: '0 0 24px rgba(167, 139, 250, 0.25)' }}
            animate={{ x: [0, -14, 0], rotate: [0, 4, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="font-mono text-xl font-extrabold text-grape">B</span>
          </motion.div>
        </div>

        {/* 双方血条对拉 */}
        <div className="w-full max-w-md space-y-2">
          {(['A', 'B'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <span className={`font-mono text-xs font-bold ${s === 'A' ? 'text-neon' : 'text-grape'}`}>{s}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-ink-edge bg-ink-bg">
                <motion.div
                  className={`h-full rounded-full ${s === 'A' ? 'bg-neon' : 'bg-grape'}`}
                  animate={{ width: ['8%', i === 0 ? '72%' : '64%', '8%'] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 阶段文案 */}
        <motion.p
          key={phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-xs tracking-[0.3em] text-slate-400"
        >
          {PHASES[phase]}
        </motion.p>
      </div>
    </div>
  )
}
