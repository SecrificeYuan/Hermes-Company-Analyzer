'use client'

import { useMemo } from 'react'
import { sentimentWordFrequency } from '@/lib/analysis/sentiment-word-frequency'
import type { SentimentItem } from '@/lib/types'

const SIZES = ['text-sm', 'text-base', 'text-xl', 'text-2xl']

function toneClass(avgTone: number): string {
  if (avgTone >= 2) return 'text-safe/55'
  if (avgTone <= -2) return 'text-danger/55'
  return 'text-slate-300/40'
}

/** 舆情仪表盘的低对比度背景，只呈现已加载新闻标题的高频财经词。 */
export function SentimentWordCloud({ items }: { items: SentimentItem[] }) {
  const words = useMemo(() => sentimentWordFrequency(items, 6), [items])
  if (words.length === 0) return null
  const maxCount = words[0].count

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 grid h-[150px] grid-cols-2 content-evenly gap-x-3 overflow-hidden px-3 py-2 text-center leading-tight" aria-hidden="true">
      {words.map((word, index) => {
        const level = Math.max(0, Math.min(SIZES.length - 1, Math.round(((word.count / maxCount) * (SIZES.length - 1)))))
        return (
          <span
            key={word.text}
            className={`${SIZES[level]} ${toneClass(word.avgTone)} ${index % 2 ? 'justify-self-end' : 'justify-self-start'} whitespace-nowrap font-black italic tracking-[0.08em]`}
            style={{ textShadow: '0 0 16px currentColor, 1px 1px 0 rgb(255 255 255 / 12%)' }}
          >
            {word.text} <sup className="align-top text-[9px] not-italic">{word.count}</sup>
          </span>
        )
      })}
    </div>
  )
}
