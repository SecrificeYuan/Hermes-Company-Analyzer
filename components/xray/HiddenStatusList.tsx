'use client'

import { Ghost } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useXrayStore } from '@/lib/store'
import { SignalExplainer } from './SignalExplainer'
import type { HiddenStatus } from '@/lib/types'

const SEV_LABEL = { high: '高危', mid: '注意', low: '轻微' } as const
const SEV_VARIANT = { high: 'danger', mid: 'warn', low: 'dim' } as const

function TierPips({ tier }: { tier: { current: number; max: number } }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`层数 ${tier.current}/${tier.max}`}>
      {Array.from({ length: tier.max }, (_, i) => (
        <span key={i} className={`h-2.5 w-1.5 rounded-sm ${i < tier.current ? 'bg-grape' : 'border border-edge bg-ink-bg/80'}`} />
      ))}
      <span className="ml-1 font-mono text-[10px] text-grape">{tier.current}/{tier.max} 层</span>
    </span>
  )
}

/** 隐藏状态列表：人话标题+中文严重度+层数刻度；点击开证据抽屉；可选 AI 解释展开 */
export function HiddenStatusList({ items, reportId }: { items: HiddenStatus[]; reportId?: string }) {
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
        <div key={d.id} className="glass-card glass-card-hover group p-3.5">
          <button onClick={() => setActive(d)} className="w-full text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Ghost className="h-4 w-4 text-grape" />
                {d.label}
              </span>
              <span className="flex items-center gap-2">
                {d.tier && <TierPips tier={d.tier} />}
                <Badge variant={SEV_VARIANT[d.severity]}>{SEV_LABEL[d.severity]}</Badge>
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{d.description}</p>
            <div className="mt-2 font-mono text-[10px] text-neon/60 opacity-0 transition-opacity group-hover:opacity-100">
              ▸ 点击查看 {d.evidence.length} 条证据
            </div>
          </button>
          {reportId && (
            <div className="mt-1">
              <SignalExplainer reportId={reportId} signalId={d.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
