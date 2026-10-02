'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Crosshair, Radar, Search } from 'lucide-react'
import { ScanBeam } from '@/components/scan/ScanBeam'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { Badge } from '@/components/ui/badge'
import { PRESET_COMPANIES, type PresetCompany } from '@/lib/presets'

const HINT_VARIANT = { 稳健白马: 'safe', 争议成长: 'warn', 高危预警: 'danger' } as const

export default function HomePage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState<PresetCompany | null>(null)

  const matches = useMemo(() => {
    const q = query.trim()
    if (!q) return PRESET_COMPANIES
    return PRESET_COMPANIES.filter((c) => c.name.includes(q) || c.tagline.includes(q) || c.id.includes(q))
  }, [query])

  const startScan = (company: PresetCompany) => {
    if (scanning) return
    setScanning(company)
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
      {/* 标题区 */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <div className="mb-4 flex items-center justify-center gap-2 font-mono text-xs tracking-[0.4em] text-neon/70">
          <Radar className="h-4 w-4" /> HERMES SYSTEM ONLINE
        </div>
        <h1 className="text-glow text-5xl font-bold tracking-tight text-slate-50">
          公司 <span className="text-neon">X</span> 光机
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
          输入公司名，30 秒生成一张角色卡式 X 光片 ——
          财务、司法、舆情、股权，散落线索一次看清。
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
        <Crosshair className="h-5 w-5 animate-blink text-neon/60" />
      </motion.div>

      {/* 预设公司 */}
      <div className="mt-6 grid w-full max-w-xl gap-3">
        <AnimatePresence>
          {matches.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              onClick={() => startScan(c)}
              className="glass-card glass-card-hover flex items-center justify-between px-5 py-3.5 text-left"
            >
              <div>
                <div className="font-semibold text-slate-100">{c.name}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-500">{c.tagline}</div>
              </div>
              <Badge variant={HINT_VARIANT[c.hint]}>{c.hint}</Badge>
            </motion.button>
          ))}
        </AnimatePresence>
        {matches.length === 0 && (
          <div className="py-6 text-center font-mono text-xs text-slate-500">
            未收录该公司 —— 演示版仅支持 3 家预设企业（真实数据源接入见 docs/DOC-A）
          </div>
        )}
      </div>

      <div className="mt-10 font-mono text-[11px] text-slate-600">
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
