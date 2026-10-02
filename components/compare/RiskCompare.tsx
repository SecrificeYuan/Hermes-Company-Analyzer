// components/compare/RiskCompare.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { useXrayStore } from '@/lib/store'
import { useTokens } from '@/lib/theme/use-tokens'
import type { ThemeTokens } from '@/lib/theme/types'
import type { CompanyXRay, HiddenStatus } from '@/lib/types'

const SEV_VARIANT = { high: 'danger', mid: 'warn', low: 'dim' } as const

function sevColor(t: ThemeTokens, severity: HiddenStatus['severity']) {
  return severity === 'high' ? t.colors.danger : severity === 'mid' ? t.colors.warn : t.colors.safe
}

function StatusColumn({ company, items }: { company: string; items: HiddenStatus[] }) {
  const t = useTokens()
  const setActive = useXrayStore((s) => s.setActiveStatus)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold" style={{ color: t.colors.textMain }}>{company}</span>
        <span className="font-mono text-[11px]" style={{ color: t.colors.textFaint }}>×{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-4 text-center font-mono text-xs"
          style={{ borderColor: t.colors.edge, color: t.colors.textFaint }}
        >
          无记录
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <button
              key={d.id}
              onClick={() => setActive(d)}
              className="w-full rounded-lg border border-ink-edge bg-ink-card p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: t.colors.textMain }}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sevColor(t, d.severity) }} />
                  {d.label}
                </span>
                <Badge variant={SEV_VARIANT[d.severity]}>{d.severity.toUpperCase()}</Badge>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed" style={{ color: t.colors.textDim }}>
                {d.description}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 风险事件对比：两家 hiddenStatus 清单并排，点击行开证据抽屉（EvidenceDrawer） */
export function RiskCompare({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <StatusColumn company={a.name} items={a.hiddenStatus} />
      <StatusColumn company={b.name} items={b.hiddenStatus} />
    </div>
  )
}
