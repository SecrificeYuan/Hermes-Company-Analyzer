'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Database, Radar, ShieldCheck } from 'lucide-react'
import { ScanBeam } from '@/components/scan/ScanBeam'
import { Skeleton } from '@/components/ui/skeleton'

const STAGES = [
  { icon: Database, text: '接入财务数据源' },
  { icon: Radar, text: '抓取公告 · 质押 · 股东' },
  { icon: Activity, text: '聚合舆情情绪' },
  { icon: ShieldCheck, text: '运行四维打分与隐藏状态规则' },
] as const

const TIPS = [
  'TIP · 每个结论都可以点开看证据溯源',
  'TIP · 绿色 / 黄色 / 红色 = 综合风险档位',
  'TIP · PRO 模式可切换金融终端详读版式',
  'TIP · 慢数据源不会拖住页面，先到先显示',
] as const

const STAGE_MS = 900
const TIP_MS = 2600

/** 报告页加载层：阶段日志 + 扫描光效 + 骨架屏，避免长时间白屏的枯燥感 */
export default function ReportLoading() {
  const [step, setStep] = useState(0)
  const [tip, setTip] = useState(0)

  useEffect(() => {
    const stageTimer = setInterval(() => setStep((s) => Math.min(s + 1, STAGES.length)), STAGE_MS)
    const tipTimer = setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_MS)
    return () => {
      clearInterval(stageTimer)
      clearInterval(tipTimer)
    }
  }, [])

  return (
    <main className="relative mx-auto min-h-screen max-w-7xl overflow-hidden px-6 py-8">
      <ScanBeam />

      {/* 顶部状态行 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] text-slate-500">
          <span className="inline-block h-1.5 w-1.5 animate-blink rounded-full bg-neon" />
          HERMES X-RAY · 正在接入数据源
        </div>
        <span className="font-mono text-[11px] text-slate-600">{Math.min(100, (step / STAGES.length) * 100)}%</span>
      </div>

      {/* 阶段日志 */}
      <div className="glass-card mb-6 p-5">
        <div className="space-y-2">
          {STAGES.map((stage, i) => (
            <motion.div
              key={stage.text}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: i <= step ? 1 : 0.2, x: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-2.5 font-mono text-xs ${
                i < step ? 'text-safe' : i === step ? 'text-neon' : 'text-slate-600'
              }`}
            >
              <stage.icon className="h-3.5 w-3.5" />
              <span>{i < step ? '✓' : i === step ? '▸' : '·'} {stage.text}</span>
              {i === step && <span className="animate-blink text-neon/70">▊</span>}
            </motion.div>
          ))}
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded bg-ink-card">
          <motion.div
            className="h-full bg-gradient-to-r from-neon/60 to-neon shadow-glow"
            animate={{ width: `${(step / STAGES.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* 速览层骨架 */}
      <div className="grid gap-6 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
        <Skeleton className="h-[300px] lg:col-span-2" />
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[220px]" />
        <Skeleton className="h-[220px]" />
        <Skeleton className="h-[220px]" />
      </div>

      {/* 详读层骨架 */}
      <div className="mt-8">
        <Skeleton className="mb-4 h-4 w-40" />
        <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
          <Skeleton className="hidden h-[420px] lg:block" />
          <div className="space-y-6">
            <Skeleton className="h-[260px]" />
            <Skeleton className="h-[260px]" />
          </div>
        </div>
      </div>

      {/* 底部轮换提示 */}
      <div className="mt-10 text-center">
        <motion.div
          key={tip}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[11px] text-slate-600"
        >
          {TIPS[tip]}
        </motion.div>
      </div>
    </main>
  )
}
