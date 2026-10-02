'use client'
import { LawsuitHeatmap } from '../LawsuitHeatmap'
import { RiskTimeline } from '../RiskTimeline'
import type { CompanyXRay } from '@/lib/types'

export function LegalSection({ xray }: { xray: CompanyXRay }) {
  return (
    <div className="space-y-6">
      <LawsuitHeatmap timeline={xray.timeline} height={240} />
      <RiskTimeline timeline={xray.timeline} />
    </div>
  )
}
