'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from './EChart'
import { baseChartOption, colors } from '@/lib/theme/echarts-dark'
import type { CompanyXRay, GraphNode } from '@/lib/types'

const NODE_COLOR: Record<GraphNode['type'], string> = {
  company: colors.neon,
  person: colors.grape,
  court: colors.danger,
  supplier: colors.warn,
  media: colors.textDim,
}

/** 关系图谱：力导向布局，节点发光，风险边红色 */
export function RelationGraph({ graph }: { graph: CompanyXRay['graph'] }) {
  if (graph.nodes.length <= 1) return <ChartEmpty height={320} text="暂无关联实体" />

  const option: EChartsOption = {
    ...baseChartOption,
    tooltip: {
      ...baseChartOption.tooltip,
      formatter: (p) => {
        const d = p as unknown as { dataType: string; data: { name?: string; label?: unknown } }
        return d.dataType === 'edge' ? String((d.data as { label?: string }).label ?? '') : String(d.data.name ?? '')
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        force: { repulsion: 320, edgeLength: [70, 130], gravity: 0.12 },
        label: { show: true, color: colors.textMain, fontSize: 11, position: 'bottom' },
        data: graph.nodes.map((n) => ({
          id: n.id,
          name: n.name,
          symbolSize: n.type === 'company' ? 56 : 26 + n.risk * 0.18,
          itemStyle: {
            color: NODE_COLOR[n.type],
            shadowBlur: n.risk > 50 ? 18 : 8,
            shadowColor: n.risk > 50 ? 'rgba(255,59,92,0.6)' : NODE_COLOR[n.type],
            borderColor: 'rgba(255,255,255,0.25)',
            borderWidth: 1,
          },
        })),
        links: graph.links.map((l) => ({
          source: l.source,
          target: l.target,
          label: { show: true, formatter: l.label, color: colors.textDim, fontSize: 10 },
          lineStyle: {
            color: l.risk ? colors.danger : 'rgba(0,229,255,0.35)',
            width: l.risk ? 2.5 : 1.2,
            curveness: 0.12,
            shadowBlur: l.risk ? 8 : 0,
            shadowColor: colors.danger,
          },
        })),
        emphasis: { focus: 'adjacency' },
      },
    ],
  }
  return <EChart option={option} height={340} />
}
