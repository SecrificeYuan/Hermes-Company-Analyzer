'use client'

import { FileSearch } from 'lucide-react'
import { useXrayStore } from '@/lib/store'
import { getTerms } from '@/lib/theme/terms'
import { NARRATIVE_ICONS, narrativeCopy } from '@/lib/narrative-copy'
import type { CompanyXRay, HiddenStatus, NarrativeKey } from '@/lib/types'

const SEV_ORDER = { high: 0, mid: 1, low: 2 } as const

function pickEvidence(items: HiddenStatus[]): HiddenStatus | undefined {
  return [...items].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])[0]
}

/** LITE 叙事卡：图标 + 关键数字 + 一段人话 + 证据入口（规格 §5.1 E） */
export function NarrativeCard({ id, k, xray }: { id: string; k: NarrativeKey; xray: CompanyXRay }) {
  const setActiveStatus = useXrayStore((s) => s.setActiveStatus)
  const terms = getTerms('lite')
  const model = k === 'atk' && xray.atk.available === false
    ? { big: '暂无法判断', caption: '司法数据暂未接入', text: '当前无法核验诉讼、被执行与失信记录，不能据此推断公司不存在司法风险。' }
    : k === 'morale' && xray.morale.available === false
    ? { big: '待加载', caption: '东方财富新闻', text: '舆情数据正在独立获取，暂不生成正面或负面结论。' }
    : narrativeCopy(k, xray)
  const evidence = pickEvidence(xray.hiddenStatus)

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
