'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const STAGES = [
  '接入财务数据源 …',
  '抓取公告与涉诉记录 …',
  '聚合舆情情绪 …',
  '运行四维打分与隐藏状态规则 …',
  '生成 X 光片 …',
]

/** 扫描过场的进度面板：模拟终端日志逐行点亮，营造"正在分析"的仪式感 */
export function ScanProgress({ companyName, onDone }: { companyName: string; onDone?: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= STAGES.length) {
      const t = setTimeout(() => onDone?.(), 300)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => s + 1), 420)
    return () => clearTimeout(t)
  }, [step, onDone])

  return (
    <div className="font-mono text-sm">
      <div className="mb-3 text-neon text-glow">
        &gt; SCAN TARGET: <span className="text-slate-100">{companyName}</span>
      </div>
      <div className="space-y-1.5">
        {STAGES.map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: i <= step ? 1 : 0.25, x: 0 }}
            className={i < step ? 'text-safe' : i === step ? 'text-neon' : 'text-slate-500'}
          >
            {i < step ? '✓' : i === step ? '▸' : '·'} {s}
          </motion.div>
        ))}
      </div>
      <div className="mt-4 h-1 w-full overflow-hidden rounded bg-ink-card">
        <motion.div
          className="h-full bg-neon shadow-glow"
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(100, (step / STAGES.length) * 100)}%` }}
        />
      </div>
    </div>
  )
}
