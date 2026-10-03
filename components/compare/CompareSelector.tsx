// components/compare/CompareSelector.tsx
'use client'

import { Check, GitCompareArrows, Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompanySearchInput } from '@/components/search/CompanySearchInput'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'

type Slot = 'A' | 'B'

/** 宽松选择形状：上市公司（sub=股票代码）与快照主体（sub=身份标签）共用 */
export type SlotPick = { id: string; name: string; sub?: string }

export function CompareSelector({
  value,
  onChange,
  onRun,
  loading,
  sameCompany,
  canCopy,
  copied,
  onCopy,
}: {
  value: Record<Slot, SlotPick | null>
  onChange: (slot: Slot, pick: SlotPick | null) => void
  onRun: () => void
  loading: boolean
  sameCompany: boolean
  canCopy: boolean
  copied: boolean
  onCopy: () => void
}) {
  const mode = useMode()
  const terms = getTerms(mode).compare
  const bothPicked = value.A !== null && value.B !== null

  return (
    <div className="glass-card flex flex-wrap items-end justify-center gap-4 p-6">
      {(['A', 'B'] as Slot[]).map((slot) => {
        const picked = value[slot]
        return (
          <label key={slot} className="flex flex-col gap-1.5 font-mono text-xs text-slate-400">
            {terms.slotLabel.replace('{slot}', slot)}
            {picked ? (
              <div className="flex items-center gap-3 rounded-btn border border-neon/30 bg-ink-card px-3 py-2">
                <span className="text-sm font-semibold text-slate-100">{picked.name}</span>
                <span className="font-mono text-xs text-slate-500">{picked.sub ?? ''}</span>
                <button
                  type="button"
                  aria-label={`重选公司 ${slot}`}
                  disabled={loading}
                  onClick={() => onChange(slot, null)}
                  className="text-slate-500 transition-colors hover:text-slate-200 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <CompanySearchInput
                placeholder="搜公司名称或代码…"
                disabled={loading}
                onPick={(company) => onChange(slot, { id: company.id, name: company.name, sub: company.stockCode })}
              />
            )}
          </label>
        )
      })}
      <Button onClick={onRun} disabled={loading || sameCompany || !bothPicked} size="lg">
        <GitCompareArrows />
        {loading ? terms.actionLoading : terms.action}
      </Button>
      {canCopy && (
        <Button variant="ghost" size="sm" onClick={onCopy}>
          {copied ? <Check /> : <Link2 />}
          {copied ? terms.copied : terms.copyLink}
        </Button>
      )}
    </div>
  )
}
