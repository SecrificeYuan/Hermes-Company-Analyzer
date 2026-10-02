'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { sentimentWordFrequency, type SentimentWord } from '@/lib/analysis/sentiment-word-frequency'
import type { SentimentItem } from '@/lib/types'

const SIZES = ['text-sm', 'text-base', 'text-xl', 'text-2xl']
/** 词榜稳定判定：词序列停止变化这么久后才渲染，避免边算边冒、冒完就被挤掉 */
const SETTLE_MS = 600

/** 词进出场缓动：入场 ease-out 柔停，出场短促 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

function toneClass(avgTone: number): string {
  if (avgTone >= 2) return 'text-safe/55'
  if (avgTone <= -2) return 'text-danger/55'
  return 'text-slate-300/40'
}

function sameWords(a: SentimentWord[], b: SentimentWord[]): boolean {
  return a.length === b.length && a.every((w, i) => w.text === b[i].text && w.count === b[i].count && w.avgTone === b[i].avgTone)
}

/** 舆情仪表盘的低对比度背景，只呈现已加载新闻标题的高频财经词。 */
export function SentimentWordCloud({ items }: { items: SentimentItem[] }) {
  // 词榜随新闻流陆续变化；等它连续 SETTLE_MS 不再变才落一版，保证出现时已排序定稿。
  // 之后的正常更替（新词上榜/旧词出局）才交给 AnimatePresence 走动画。
  const [settled, setSettled] = useState<SentimentWord[] | null>(null)
  const pendingRef = useRef<SentimentWord[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const next = sentimentWordFrequency(items, 6)
    pendingRef.current = next
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setSettled((prev) => (prev && sameWords(prev, pendingRef.current) ? prev : pendingRef.current))
    }, SETTLE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [items])

  if (!settled || settled.length === 0) return null
  const words = settled
  const maxCount = words[0].count

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 grid h-[150px] grid-cols-2 content-evenly gap-x-3 overflow-hidden px-3 py-2 text-center leading-tight" aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={true}>
        {words.map((word, index) => {
          const level = Math.max(0, Math.min(SIZES.length - 1, Math.round(((word.count / maxCount) * (SIZES.length - 1)))))
          return (
            <motion.span
              key={word.text}
              layout
              initial={{ opacity: 0, scale: 0.7, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.5, delay: index * 0.05, ease: EASE } }}
              exit={{ opacity: 0, scale: 0.7, filter: 'blur(6px)', transition: { duration: 0.25, ease: 'easeIn' } }}
              className={`${SIZES[level]} ${toneClass(word.avgTone)} ${index % 2 ? 'justify-self-end' : 'justify-self-start'} whitespace-nowrap font-black italic tracking-[0.08em]`}
              style={{ textShadow: '0 0 16px currentColor, 1px 1px 0 rgb(255 255 255 / 12%)' }}
            >
              {word.text} <sup className="align-top text-[9px] not-italic">{word.count}</sup>
            </motion.span>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
