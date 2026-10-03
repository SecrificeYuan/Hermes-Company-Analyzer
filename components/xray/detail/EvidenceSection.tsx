'use client'
import { HiddenStatusList } from '../HiddenStatusList'
import { AnnouncementList } from './AnnouncementList'
import { announcementsFor } from './announcement-split'
import type { CompanyXRay } from '@/lib/types'

export function EvidenceSection({ xray }: { xray: CompanyXRay }) {
  return (
    <div className="space-y-6">
      <p className="text-xs leading-relaxed text-slate-400">
        全部风险事件与对应证据如下，点击任意条目可查看来源、日期与原文链接。
      </p>
      <HiddenStatusList items={xray.hiddenStatus} reportId={xray.id} />
      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">其余公告（年报 / 财务 / 其他）</h4>
        <AnnouncementList items={announcementsFor('evidence', xray.detail?.announcements ?? [])} max={15} />
      </div>
    </div>
  )
}
