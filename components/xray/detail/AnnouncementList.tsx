'use client'

import type { Announcement } from '@/lib/types'

/** 公告紧凑列表：日期 + 类型徽标 + 标题（外链），供各 PRO section 按类型分流后复用。 */
export function AnnouncementList({ items, max = 8 }: { items: Announcement[]; max?: number }) {
  if (items.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-btn border border-dashed border-edge font-mono text-xs text-slate-500">
        ░ 该类别暂无公告
      </div>
    )
  }
  const shown = items.slice(0, max)
  return (
    <ul className="divide-y divide-edge/50 rounded-btn border border-edge">
      {shown.map((a) => (
        <li key={`${a.date}-${a.title}`}>
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-baseline gap-3 px-3 py-2 text-xs transition-colors hover:bg-neon/5"
          >
            <span className="shrink-0 font-mono text-[10px] text-slate-500">{a.date.slice(0, 10)}</span>
            <span className="shrink-0 rounded border border-edge px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
              {a.type}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-300">{a.title}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
