'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { History } from 'lucide-react'
import { NetworkBg } from '@/components/home/NetworkBg'
import { FlashMarquee } from '@/components/home/FlashMarquee'
import { FilterPanel } from '@/components/home/FilterPanel'
import { SearchBox } from '@/components/home/SearchBox'
import { ScanBeam } from '@/components/scan/ScanBeam'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { addSearchHistory, getSearchHistory, type SearchRecord } from '@/lib/search-history'
import type { ListedCompany } from '@/lib/data/eastmoney'

export default function HomePage() {
  const router = useRouter()
  const [history, setHistory] = useState<SearchRecord[]>(() => getSearchHistory())
  const [scanning, setScanning] = useState<{ id: string; name: string } | null>(null)
  const [queryMode, setQueryMode] = useState<'search' | 'filter'>('search')

  const handlePick = (company: ListedCompany) => {
    if (scanning) return
    setHistory(addSearchHistory(company))
    setScanning(company)
  }

  const handleRescan = (record: SearchRecord) => {
    if (scanning) return
    setHistory(addSearchHistory(record))
    setScanning(record)
  }

  return (
    <main data-theme="home" className="relative flex h-[calc(100vh-2.25rem)] flex-col overflow-hidden">
      <NetworkBg />

      {/* 顶栏 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <span className="font-mono text-xs tracking-[0.25em] text-slate-400">HERMES</span>
        <span className="font-mono text-[11px] text-slate-600">v0.9 · DEMO</span>
      </header>

      {/* Hero + 搜索/筛选 + 最近搜索 */}
      <div className={`relative z-10 flex min-h-0 flex-1 flex-col items-center px-6 [&:has(.glass-card-hover:hover)]:z-30 ${queryMode === 'filter' ? 'overflow-y-auto' : 'justify-center'}`}>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`shrink-0 text-center ${queryMode === 'filter' ? 'mt-10 mb-6' : 'mb-10'}`}
        >
          <div className="mb-4 font-mono text-[11px] tracking-[0.35em] text-neon/80">
            HERMES SYSTEM ONLINE
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-50">公司透视</h1>
          <div role="group" aria-label="查询方式" className="mx-auto mt-6 inline-grid grid-cols-2 rounded-btn border border-ink-edge bg-ink-card p-1">
            <button
              type="button"
              aria-pressed={queryMode === 'search'}
              onClick={() => setQueryMode('search')}
              className={`min-w-28 rounded-btn px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon ${queryMode === 'search' ? 'bg-neon text-ink-bg' : 'text-slate-400 hover:text-slate-100'}`}
            >
              搜索
            </button>
            <button
              type="button"
              aria-pressed={queryMode === 'filter'}
              onClick={() => setQueryMode('filter')}
              className={`min-w-28 rounded-btn px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon ${queryMode === 'filter' ? 'bg-neon text-ink-bg' : 'text-slate-400 hover:text-slate-100'}`}
            >
              条件筛选
            </button>
          </div>
          {queryMode === 'search' && (
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              输入公司名，30 秒生成一张公司透视报告 —— 财务、司法、舆情、股权，散落线索一次看清。
            </p>
          )}
        </motion.div>

        {queryMode === 'filter' ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10 flex w-full justify-center"
          >
            <FilterPanel />
          </motion.div>
        ) : (
        <>

        {/* 搜索框（候选下拉） */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex w-full max-w-xl justify-center"
        >
          <SearchBox onPick={handlePick} />
        </motion.div>

        {/* 最近搜索记录 */}
        <div className="mt-6 w-full max-w-xl">
          {history.length === 0 ? (
            <div className="glass-card py-6 text-center font-mono text-xs text-slate-500">
              暂无搜索记录 —— 在上方搜索一家 A 股公司，开始第一次透视
            </div>
          ) : (
            history.map((r) => (
              <button
                key={r.id}
                onClick={() => handleRescan(r)}
                className="glass-card glass-card-hover mb-3 flex w-full items-center gap-4 px-5 py-3.5 text-left"
              >
                <History className="h-4 w-4 shrink-0 text-neon/70" />
                <div className="flex-1">
                  <div className="font-semibold text-slate-100">{r.name}</div>
                </div>
                <span className="font-mono text-xs text-slate-500">{r.stockCode}</span>
              </button>
            ))
          )}
        </div>
        </>
        )}
      </div>

      {/* 底部快讯跑马灯（替代原能力带） */}
      <FlashMarquee />

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
