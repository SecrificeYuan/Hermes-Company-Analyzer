// components/compare/CompareSelector.tsx
'use client'

import { Check, GitCompareArrows, Link2, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PRESET_COMPANIES } from '@/lib/presets'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'

type Slot = 'A' | 'B'

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
  value: Record<Slot, string>
  onChange: (slot: Slot, id: string) => void
  onRun: () => void
  loading: boolean
  sameCompany: boolean
  canCopy: boolean
  copied: boolean
  onCopy: () => void
}) {
  const mode = useMode()
  const terms = getTerms(mode).compare

  return (
    <div className="glass-card flex flex-wrap items-end justify-center gap-4 p-6">
      {(['A', 'B'] as Slot[]).map((slot) => (
        <label key={slot} className="flex flex-col gap-1.5 font-mono text-xs text-slate-400">
          {terms.slotLabel.replace('{slot}', slot)}
          <select
            value={value[slot]}
            disabled={loading}
            onChange={(e) => onChange(slot, e.target.value)}
            className="rounded-btn border border-neon/30 bg-ink-card px-3 py-2 text-sm text-slate-100 focus:outline-none disabled:opacity-50"
          >
            {PRESET_COMPANIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      ))}
      <Button onClick={onRun} disabled={loading || sameCompany} size="lg">
        {mode === 'pro' ? <GitCompareArrows /> : <Swords />}
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
