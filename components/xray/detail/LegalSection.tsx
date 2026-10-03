'use client'
import { LawsuitHeatmap } from '../LawsuitHeatmap'
import { RiskTimeline } from '../RiskTimeline'
import { DetailTable } from './DataTable'
import { AnnouncementList } from './AnnouncementList'
import { announcementsFor } from './announcement-split'
import { formatWan } from '@/lib/utils'
import type { CompanyXRay } from '@/lib/types'

export function LegalSection({ xray }: { xray: CompanyXRay }) {
  const detail = xray.detail
  const available = xray.atk.available !== false
  const lawsuits = detail?.lawsuits ?? []
  const executions = detail?.executions ?? []
  const dishonest = detail?.dishonest ?? 0
  return (
    <div className="space-y-6">
      {available ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="诉讼数量（已读取资料）" value={`${xray.atk.lawsuitCount} 起`} />
          <Metric label="被执行金额" value={formatWan(xray.atk.executionAmount)} />
          <Metric label="失信被执行" value={dishonest > 0 ? `${dishonest} 次` : '0'} highlight={dishonest > 0} />
        </div>
      ) : (
        <div className="rounded-btn border border-warn/40 bg-warn/5 px-4 py-3 text-sm text-slate-300">
          司法数据暂未接入，无法判断是否存在诉讼、被执行或失信记录；下方仅保留已获取的公告线索，需结合原始公告继续核查。
        </div>
      )}
      <LawsuitHeatmap timeline={xray.timeline} available={available} height={220} />
      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">诉讼明细</h4>
        <DetailTable
          rows={lawsuits}
          rowKey={(l) => `${l.date}-${l.cause}-${l.amount}`}
          columns={[
            { key: 'date', label: '日期', render: (l) => l.date.slice(0, 10) },
            { key: 'role', label: '角色', render: (l) => l.role },
            { key: 'cause', label: '案由', render: (l) => <span className="text-slate-400">{l.cause}</span> },
            { key: 'amount', label: '涉案金额', align: 'right', render: (l) => formatWan(l.amount) },
          ]}
          empty={available ? '░ 已读取资料中未发现诉讼记录' : '░ 司法数据暂不可用，无法判断是否存在诉讼记录'}
        />
      </div>
      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">被执行记录</h4>
        <DetailTable
          rows={executions}
          rowKey={(e) => `${e.date}-${e.amount}-${e.status}`}
          columns={[
            { key: 'date', label: '日期', render: (e) => e.date.slice(0, 10) },
            { key: 'status', label: '状态', render: (e) => <span className="text-slate-400">{e.status}</span> },
            { key: 'amount', label: '执行标的', align: 'right', render: (e) => formatWan(e.amount) },
          ]}
          empty={available ? '░ 已读取资料中未发现被执行记录' : '░ 司法数据暂不可用，无法判断是否存在被执行记录'}
        />
      </div>
      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">诉讼 / 问询类公告</h4>
        <AnnouncementList items={announcementsFor('legal', detail?.announcements ?? [])} />
      </div>
      <RiskTimeline timeline={xray.timeline} />
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-btn border border-edge px-3 py-2">
      <div className="font-mono text-[10px] text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-semibold ${highlight ? 'text-danger' : 'text-slate-200'}`}>{value}</div>
    </div>
  )
}
