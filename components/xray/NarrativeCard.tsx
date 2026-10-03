'use client'

import { FileSearch } from 'lucide-react'
import { useXrayStore } from '@/lib/store'
import { getTerms } from '@/lib/theme/terms'
import { NARRATIVE_ICONS, narrativeCopy } from '@/lib/narrative-copy'
import type { CompanyXRay, CourtSearchResult, HiddenStatus, NarrativeKey } from '@/lib/types'

const SEV_ORDER = { high: 0, mid: 1, low: 2 } as const

function pickEvidence(items: HiddenStatus[]): HiddenStatus | undefined {
  return [...items].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])[0]
}

/** LITE 叙事卡：图标 + 关键数字 + 一段人话 + 证据入口（规格 §5.1 E）；compact 用于 Hero 右侧竖列 */
export function NarrativeCard({ id, k, xray, compact, court }: { id: string; k: NarrativeKey; xray: CompanyXRay; compact?: boolean; court?: CourtSearchResult | null }) {
  const setActiveStatus = useXrayStore((s) => s.setActiveStatus)
  const terms = getTerms('lite')
  const model = narrativeCopy(k, xray)
  const evidence = pickEvidence(xray.hiddenStatus)

  if (compact) {
    return (
      <section id={id} className="glass-card scroll-mt-24 p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-100">
            <span aria-hidden>{NARRATIVE_ICONS[k]}</span>
            {terms.dimensionTitles[k]}
          </div>
          <span className="shrink-0 text-right">
            <span className="text-lg font-extrabold text-slate-50">{model.big}</span>{' '}
            <span className="font-mono text-[10px] text-slate-500">{model.caption}</span>
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-300">{model.text}</p>
        {k === 'atk' && <CourtCompact result={court ?? null} />}
        {evidence && (
          <button
            onClick={() => setActiveStatus(evidence)}
            className="mt-2 inline-flex items-center gap-1 rounded-btn border border-neon/40 px-2 py-1 font-mono text-[10px] text-neon transition-colors hover:bg-neon/10"
          >
            <FileSearch className="h-3 w-3" />
            查看证据
          </button>
        )}
      </section>
    )
  }

  return (
    <section id={id} className="glass-card scroll-mt-24 p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100">
        <span aria-hidden>{NARRATIVE_ICONS[k]}</span>
        {terms.dimensionTitles[k]}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-slate-50">{model.big}</span>
        <span className="font-mono text-[10px] text-slate-500">{model.caption}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{model.text}</p>
      {k === 'atk' && <CourtCompact result={court ?? null} />}
      {evidence && (
        <button
          onClick={() => setActiveStatus(evidence)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-btn border border-neon/40 px-3 py-1.5 font-mono text-[11px] text-neon transition-colors hover:bg-neon/10"
        >
          <FileSearch className="h-3.5 w-3.5" />
          查看证据
        </button>
      )}
    </section>
  )
}

function CourtCompact({ result }: { result: CourtSearchResult | null }) {
  const message = !result ? '法院公告网：正在检索…' :
    result.historical && result.records.length === 0 ? '法院公告网：仅有历史快照，当前公告待复核' :
    result.status === 'available' || result.status === 'partial' ? `法院公告网：近 12 个月匹配 ${result.records.length} 条公告${result.historical ? '（历史抓取，部分结果）' : result.status === 'partial' ? '（部分结果）' : ''}` :
    result.status === 'empty' ? '法院公告网：近 12 个月未匹配到公告' :
    result.status === 'identity_unverified' ? '法院公告网：公司全称待核实' : '法院公告网：暂无法读取'
  return <p className="mt-2 border-t border-edge/50 pt-2 text-[11px] text-slate-400">{message}；公告不等于案件数。</p>
}
