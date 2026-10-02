'use client'
import { RelationGraph } from '../RelationGraph'
import { DetailTable } from './DataTable'
import type { CompanyXRay } from '@/lib/types'

const TYPE_LABEL: Record<string, string> = {
  company: '公司', person: '人员', holder: '股东', court: '法院', supplier: '供应商', media: '媒体',
}

export function NetworkSection({ xray }: { xray: CompanyXRay }) {
  const nodes = [...xray.graph.nodes].filter((n) => n.type !== 'company').sort((a, b) => b.risk - a.risk)
  return (
    <div className="space-y-6">
      <RelationGraph graph={xray.graph} centerLabel={xray.name} height={360} />
      <div>
        <h4 className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">风险节点（按风险值排序）</h4>
        <DetailTable
          rows={nodes}
          rowKey={(n) => n.id}
          columns={[
            { key: 'name', label: '名称', render: (n) => <span className="text-slate-300">{n.name}</span> },
            { key: 'type', label: '类型', render: (n) => <span className="text-slate-500">{TYPE_LABEL[n.type] ?? n.type}</span> },
            {
              key: 'risk', label: '风险值', align: 'right', render: (n) => (
                <span className={n.risk >= 70 ? 'text-danger' : n.risk >= 40 ? 'text-warn' : 'text-safe'}>
                  {n.risk}
                </span>
              ),
            },
          ]}
          empty="░ 网络数据暂缺"
        />
      </div>
    </div>
  )
}
