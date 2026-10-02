// components/market/MarketTicker.tsx
'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import type { IndexQuote } from '@/lib/data/adapters/market'

const REFRESH_MS = 60_000
const COPIES = 4 // 跑马灯复制份数，需能整除 keyframes 位移百分比

/** 全站顶部全球指数跑马灯（A股/港美股，腾讯快照，红涨绿跌） */
export function MarketTicker() {
  const [indices, setIndices] = useState<IndexQuote[] | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/market/indices')
        const data = (await res.json()) as { ok: boolean; indices: IndexQuote[] }
        if (alive && data.ok) setIndices(data.indices)
      } catch {
        /* 行情源不可用时不渲染跑马灯 */
      }
    }
    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  if (!indices || indices.length === 0) return null

  return (
    <div className="sticky top-0 z-40 flex h-9 items-center overflow-hidden border-b border-ink-edge bg-ink-bg/90 backdrop-blur">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-ink-edge px-3 font-mono text-[10px] tracking-[0.2em] text-neon">
        <Activity className="h-3 w-3 animate-pulse" />
        全球指数
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex w-max items-center gap-8 pl-8"
          style={{ animation: `ticker-scroll ${COPIES * 10}s linear infinite` }}
        >
          {Array.from({ length: COPIES }).flatMap((_, copy) =>
            indices.map((idx, i) => (
              <span
                key={`${copy}-${i}`}
                className="flex items-center gap-2 whitespace-nowrap font-mono text-[11px]"
              >
                <span className="text-slate-400">{idx.name}</span>
                <span className="text-slate-200">{idx.price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                <span className={idx.changePct >= 0 ? 'text-danger' : 'text-safe'}>
                  {idx.changePct >= 0 ? '▲' : '▼'}
                  {Math.abs(idx.changePct).toFixed(2)}%
                </span>
              </span>
            )),
          )}
        </div>
      </div>
    </div>
  )
}
