'use client'
import { StatNumber } from '../StatNumber'
import { DetailTable } from './DataTable'
import { AnnouncementList } from './AnnouncementList'
import { announcementsFor } from './announcement-split'
import { formatWan } from '@/lib/utils'
import { useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

/** 质押大数字摘要：速览层 equity 图位使用（详读层见 EquitySection） */
export function PledgeSummary({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const p = xray.def.pledgeRatio
  const color = p >= 60 ? t.riskColor.red : p >= 40 ? t.riskColor.yellow : t.riskColor.green
  const status = p >= 60 ? '已爆预警线' : p >= 40 ? '逼近预警线' : '未质押警戒'
  return (
    <div className="flex items-center gap-8">
      <div>
        <div className="flex items-baseline gap-2">
          <StatNumber value={p} className="text-5xl font-extrabold" duration={1.2} />
          <span className="text-2xl font-bold" style={{ color }}>%</span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-500">股权质押比例 · {status}</div>
      </div>
      <div className="font-mono text-xs leading-relaxed text-slate-400">
        实控人质押占总股本 {xray.def.pledgeRatio}%<br />
        资产覆盖率 {xray.def.assetCoverage}
      </div>
    </div>
  )
}

/** 股权与质押：质押大数字 + 十大股东表 + 人事事件表 + 减持/质押类公告 */
export function EquitySection({ xray }: { xray: CompanyXRay }) {
  const shareholders = xray.detail?.shareholders ?? []
  const people = xray.detail?.people ?? []

  return (
    <div className="space-y-6">
      <PledgeSummary xray={xray} />

      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">十大股东</h4>
        <DetailTable
          rows={shareholders}
          rowKey={(s) => s.name}
          columns={[
            { key: 'name', label: '股东名称', render: (s) => <span className="text-slate-300">{s.name}</span> },
            {
              key: 'inst', label: '性质', render: (s) => (
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${s.isInstitution ? 'border-neon/40 text-neon' : 'border-edge text-slate-400'}`}>
                  {s.isInstitution ? '机构' : '个人'}
                </span>
              ),
            },
            { key: 'ratio', label: '持股比例', align: 'right', render: (s) => `${s.ratio.toFixed(2)}%` },
            { key: 'date', label: '报告期', align: 'right', render: (s) => s.date ?? '—' },
          ]}
          empty="░ 股东数据暂缺"
        />
      </div>

      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">人事事件（减持 / 增持 / 离职 / 质押）</h4>
        <DetailTable
          rows={people}
          rowKey={(e) => `${e.name}-${e.event}-${e.date}`}
          maxRows={10}
          columns={[
            { key: 'date', label: '日期', render: (e) => e.date.slice(0, 10) },
            { key: 'name', label: '姓名', render: (e) => e.name },
            { key: 'role', label: '职务', render: (e) => <span className="text-slate-400">{e.role}</span> },
            { key: 'event', label: '事件', render: (e) => <span className={e.event === '减持' || e.event === '离职' ? 'text-danger' : 'text-safe'}>{e.event}</span> },
            {
              key: 'amount', label: '金额 / 比例', align: 'right', render: (e) =>
                e.amount === undefined ? '—' : e.event === '质押' ? `${e.amount.toFixed(2)}%` : formatWan(e.amount),
            },
          ]}
          empty="░ 近 12 个月无人事事件"
        />
      </div>

      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">减持 / 质押类公告</h4>
        <AnnouncementList items={announcementsFor('equity', xray.detail?.announcements ?? [])} />
      </div>
    </div>
  )
}
