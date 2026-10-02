'use client'
import { HiddenStatusList } from '../HiddenStatusList'
import type { CompanyXRay } from '@/lib/types'

export function EvidenceSection({ xray }: { xray: CompanyXRay }) {
  return (
    <div>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">
        全部风险事件与对应证据如下，点击任意条目可查看来源、日期与原文链接。
      </p>
      <HiddenStatusList items={xray.hiddenStatus} />
    </div>
  )
}
