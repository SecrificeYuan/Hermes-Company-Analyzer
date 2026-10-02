// components/home/FlashMarquee.tsx
'use client'

import { useEffect, useState } from 'react'

const REFRESH_MS = 120_000
const COPIES = 2 // 配 ticker-scroll-2（-50% 位移无缝回绕）
const ROWS = 3
/** 每行滚动周期（s），错开速度；中排反向 */
const ROW_DURATIONS = [120, 160, 200]

interface FlashNews {
  title: string
  url: string
  time: string
}

/** 首页底部快讯弹幕：占页面 1/3 高度，三行错速滚动，向上渐隐融入页面 */
export function FlashMarquee() {
  const [news, setNews] = useState<FlashNews[]>([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/news/flash')
        const data = (await res.json()) as { ok: boolean; news: FlashNews[] }
        if (alive && data.ok) setNews(data.news)
      } catch {
        /* 快讯源不可用时只渲染空块，不残留占位 */
      }
    }
    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  if (news.length === 0) return null

  // 轮流分入三行，保证每行条数均匀
  const rows = Array.from({ length: ROWS }, (_, r) => news.filter((_, i) => i % ROWS === r))

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex h-[33vh] flex-col overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to top, black 55%, transparent)',
        WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent)',
      }}
      aria-hidden="true"
    >
      {rows.map((row, r) => (
        <div key={r} className="relative flex flex-1 items-center overflow-hidden">
          <div
            className="flex w-max items-center gap-5 pl-5"
            style={{
              animation: `ticker-scroll-2 ${ROW_DURATIONS[r]}s linear infinite`,
              animationDirection: r % 2 === 1 ? 'reverse' : 'normal',
              opacity: 0.75 - r * 0.15,
            }}
          >
            {Array.from({ length: COPIES }).flatMap((_, copy) =>
              row.map((n, i) => (
                <span
                  key={`${copy}-${i}`}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-ink-edge/60 bg-ink-card/40 px-3 py-1 text-xs text-slate-400"
                >
                  <span className="font-mono text-[10px] text-slate-600">{n.time}</span>
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                    className="pointer-events-auto transition-colors hover:text-neon"
                  >
                    {n.title}
                  </a>
                </span>
              )),
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
