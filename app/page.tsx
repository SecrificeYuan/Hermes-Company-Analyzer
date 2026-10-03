'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { History } from 'lucide-react'
import { NetworkBg } from '@/components/home/NetworkBg'
import { FlashMarquee } from '@/components/home/FlashMarquee'
import { FilterPanel } from '@/components/home/FilterPanel'
import { SearchBox } from '@/components/home/SearchBox'
import { addSearchHistory, getSearchHistory, type SearchRecord } from '@/lib/search-history'
import type { CompanyIdentity } from '@/lib/company'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<'search' | 'filter'>('search')
  const [history, setHistory] = useState<SearchRecord[]>([])
  useEffect(() => setHistory(getSearchHistory()), [])

  const handlePick = (company: CompanyIdentity) => {
    setHistory(addSearchHistory(company))
    router.push(`/report/${company.id}`)
  }

  const handleRescan = (record: SearchRecord) => {
    setHistory(addSearchHistory(record))
    router.push(`/report/${record.id}`)
  }

  return (
    <main data-theme="home" className="relative flex h-[calc(100vh-2.25rem)] flex-col overflow-hidden">
      <NetworkBg />

      {/* 顶栏 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <span className="font-mono text-xs tracking-[0.25em] text-slate-400">HERMES</span>
        <span className="font-mono text-[11px] text-slate-600">v0.9 · DEMO</span>
      </header>

      {/* Hero + 搜索 + 最近搜索 */}
      <div className="relative z-20 flex flex-1 flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="mb-4 font-mono text-[11px] tracking-[0.35em] text-neon/80">
            HERMES SYSTEM ONLINE
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-50">公司透视</h1>
          <div role="group" aria-label="查询方式" className="mx-auto mt-6 inline-grid grid-cols-2 rounded-btn border border-ink-edge bg-ink-card p-1">
            <button
              type="button"
              aria-pressed={mode === 'search'}
              onClick={() => setMode('search')}
              className={`min-w-28 rounded-btn px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon ${mode === 'search' ? 'bg-neon text-ink-bg' : 'text-slate-400 hover:text-slate-100'}`}
            >
              搜索
            </button>
            <button
              type="button"
              aria-pressed={mode === 'filter'}
              onClick={() => setMode('filter')}
              className={`min-w-28 rounded-btn px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon ${mode === 'filter' ? 'bg-neon text-ink-bg' : 'text-slate-400 hover:text-slate-100'}`}
            >
              条件筛选
            </button>
          </div>
          {mode === 'search' && (
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              从公开证据了解一家公司的健康状况，评估投资前还需要核实什么。
            </p>
          )}
        </motion.div>

        <div className={mode === 'search' ? 'w-full max-w-xl' : 'hidden'}>
          {/* 搜索框（候选下拉） */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex w-full justify-center"
          >
            <SearchBox onPick={handlePick} />
          </motion.div>

          {/* 最近搜索记录 */}
          <div className="mt-6 w-full">
            {history.length === 0 ? (
              <div className="glass-card py-6 text-center font-mono text-xs text-slate-500">
                暂无搜索记录 —— 搜索上市或未上市企业，开始第一次透视
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
                  <span className="font-mono text-xs text-slate-500">{r.stockCode ?? r.creditCode ?? '企业报告'}</span>
                </button>
              ))
            )}
          </div>
        </div>
        <div className={mode === 'filter' ? 'mb-10 w-full max-w-3xl' : 'hidden'}>
          <FilterPanel />
        </div>
      </div>

      {/* 底部快讯跑马灯（替代原能力带） */}
      <FlashMarquee />

      {/* footer */}
      <div className="relative z-10 border-t border-ink-edge py-3 text-center font-mono text-[11px] text-slate-600">
        公开网页与企业披露 · 证据可追溯 · 缺失数据不作推断
      </div>


    </main>
  )
}
