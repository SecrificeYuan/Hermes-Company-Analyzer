'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Coins, Crosshair, Megaphone, Network, Scale, Search } from 'lucide-react'
import { NetworkBg } from '@/components/home/NetworkBg'
import { ScanBeam } from '@/components/scan/ScanBeam'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { Badge } from '@/components/ui/badge'
import { filterPresets, type PresetCompany } from '@/lib/presets'

const HINT_VARIANT = { 稳健白马: 'safe', 争议成长: 'warn', 高危预警: 'danger' } as const

const CAPABILITIES = [
  { icon: Coins, label: '财务', note: '现金流与负债' },
  { icon: Scale, label: '司法', note: '涉诉与执行' },
  { icon: Megaphone, label: '舆情', note: '情绪与声量' },
  { icon: Network, label: '股权', note: '关联与控制' },
] as const

export default function HomePage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState<PresetCompany | null>(null)

  const matches = useMemo(() => filterPresets(query), [query])

  const startScan = (company: PresetCompany) => {
    if (scanning) return
    setScanning(company)
  }

  return (
    <main data-theme="home" className="relative flex min-h-screen flex-col overflow-hidden">
      <NetworkBg />

      {/* 顶栏 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <span className="font-mono text-xs tracking-[0.25em] text-slate-400">HERMES</span>
        <span className="font-mono text-[11px] text-slate-600">v0.9 · DEMO</span>
      </header>

      {/* Hero + 搜索 + 热门扫描 */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="mb-4 font-mono text-[11px] tracking-[0.35em] text-neon/80">
            HERMES SYSTEM ONLINE
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-50">公司透视</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            输入公司名，30 秒生成一张公司透视报告 —— 财务、司法、舆情、股权，散落线索一次看清。
          </p>
        </motion.div>

        {/* 搜索框 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card flex w-full max-w-xl items-center gap-3 px-5 py-4"
        >
          <Search className="h-5 w-5 text-neon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入公司名称或股票代码…"
            className="w-full bg-transparent font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <Crosshair className="h-4 w-4 animate-blink text-neon/60" />
          <span className="font-mono text-[11px] tracking-wider text-neon">SCAN ⏎</span>
        </motion.div>

        {/* 热门扫描榜单 */}
        <div className="mt-6 w-full max-w-xl">
          <AnimatePresence>
            {matches.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                onClick={() => startScan(c)}
                className="glass-card glass-card-hover mb-3 flex w-full items-center gap-4 px-5 py-3.5 text-left"
              >
                <span className="font-mono text-sm text-neon">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1">
                  <div className="font-semibold text-slate-100">{c.name}</div>
                  <div className="mt-0.5 font-mono text-xs text-slate-500">{c.tagline}</div>
                </div>
                <Badge variant={HINT_VARIANT[c.hint]}>{c.hint}</Badge>
              </motion.button>
            ))}
          </AnimatePresence>
          {matches.length === 0 && (
            <div className="glass-card py-6 text-center font-mono text-xs text-slate-500">
              未收录该公司 —— 演示版仅支持 3 家预设企业（真实数据源接入见 docs/DOC-A）
            </div>
          )}
        </div>
      </div>

      {/* 底部能力带 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative z-10 grid grid-cols-4 border-t border-ink-edge bg-[#070B14]/60"
      >
        {CAPABILITIES.map((cap) => (
          <div
            key={cap.label}
            className="flex flex-col items-center gap-0.5 border-r border-ink-edge px-2 py-5 last:border-r-0"
          >
            <cap.icon className="mb-1 h-5 w-5 text-neon/80" />
            <div className="text-[13px] font-semibold text-slate-100">{cap.label}</div>
            <div className="text-xs text-slate-500">{cap.note}</div>
          </div>
        ))}
      </motion.div>

      {/* footer */}
      <div className="relative z-10 border-t border-ink-edge py-3 text-center font-mono text-[11px] text-slate-600">
        DATA: MOCK / AKSHARE / CNINFO / JUHE / GDELT · 仅供演示
      </div>

      {/* 扫描过场 */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-bg/95 backdrop-blur-sm"
          >
            <ScanBeam />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card w-full max-w-md p-8"
            >
              <ScanProgress companyName={scanning.name} onDone={() => router.push(`/report/${scanning.id}`)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
