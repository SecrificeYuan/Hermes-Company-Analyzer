'use client'

import { Ghost } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useXrayStore } from '@/lib/store'
import type { HiddenStatus } from '@/lib/types'

const SEV_VARIANT = { high: 'danger', mid: 'warn', low: 'dim' } as const

/**
 * 隐藏状态（debuff）列表：点击卡片 → 右侧滑出证据抽屉。
 * hover 微微上浮 + 霓虹边框亮起。
 */
export function HiddenStatusList({ items }: { items: HiddenStatus[] }) {
  const setActive = useXrayStore((s) => s.setActiveStatus)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-safe/30 bg-safe/5 p-4 text-center font-mono text-xs text-safe">
        已读取资料中未触发风险规则；缺失资料仍需核实。
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {items.map((d) => (
        <button
          key={d.id}
          onClick={() => setActive(d)}
          className="glass-card glass-card-hover group w-full p-3.5 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Ghost className="h-4 w-4 text-grape" />
              {d.label}
            </span>
            <Badge variant={SEV_VARIANT[d.severity]}>{d.severity.toUpperCase()}</Badge>
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{d.description}</p>
          <div className="mt-2 font-mono text-[10px] text-neon/60 opacity-0 transition-opacity group-hover:opacity-100">
            ▸ 点击查看 {d.evidence.length} 条证据
          </div>
        </button>
      ))}
    </div>
  )
}
