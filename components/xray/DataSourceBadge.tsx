import { Badge } from '@/components/ui/badge'
import type { DataSourceStatus } from '@/lib/types'

/**
 * 数据来源角标：如实展示各来源状态与降级情况 —— 诚实反而加分。
 * 绿色=真实数据命中，灰色=降级到 mock。
 */
export function DataSourceBadge({ sources }: { sources?: DataSourceStatus[] }) {
  if (!sources || sources.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10px] tracking-wider text-slate-500">SOURCES</span>
      {sources.map((s) => (
        <Badge key={s.name} variant={s.ok && !s.fallback ? 'safe' : s.fallback ? 'dim' : 'warn'}>
          {s.name}
          {s.fallback ? '·降级' : ''} {s.latencyMs}ms
        </Badge>
      ))}
    </div>
  )
}
