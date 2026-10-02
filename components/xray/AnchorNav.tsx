'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface AnchorItem {
  id: string
  label: string
}

/**
 * PRO 锚点导航（scroll-spy）：桌面左侧竖排，<lg 退化为顶部 sticky 横向 chip 条。
 * 顺序由 detailOrder 传入（随版式变化）。
 */
export function AnchorNav({ items }: { items: AnchorItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id)
        }
      },
      { rootMargin: '-25% 0px -65% 0px' },
    )
    for (const { id } of items) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  return (
    <nav className="flex gap-2 overflow-x-auto lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
      {items.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className={cn(
            'shrink-0 rounded-btn border px-3 py-2 font-mono text-[11px] transition-colors',
            active === id
              ? 'border-neon/60 bg-neon/10 text-neon'
              : 'border-edge text-slate-400 hover:border-slate-600 hover:text-slate-200',
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
