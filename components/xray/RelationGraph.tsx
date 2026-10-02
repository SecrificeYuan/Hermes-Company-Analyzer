'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from './EChart'
import { baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay, GraphNode } from '@/lib/types'

/** 关系图谱：力导向布局，节点发光，风险边红色 */
export function RelationGraph({ graph, height = 340 }: { graph: CompanyXRay['graph']; height?: number }) {
  const t = useTokens()
  const mode = useMode()

  const NODE_COLOR: Record<GraphNode['type'], string> = {
    company: t.colors.accent,
    person: t.colors.grape,
    holder: t.colors.safe,
    court: t.colors.danger,
    supplier: t.colors.warn,
    media: t.colors.textDim,
  }

  if (graph.nodes.length <= 1) return <ChartEmpty height={320} text="暂无关联实体" />

  const base = baseChartOptionFor(t)
  const option: EChartsOption = {
    ...base,
    tooltip: {
      ...base.tooltip,
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
        label: { show: true, color: t.colors.textMain, fontSize: 11, position: 'bottom' },
        data: graph.nodes.map((n) => ({
          id: n.id,
          name: n.name,
          symbolSize: n.type === 'company' ? 56 : 26 + n.risk * 0.18,
          itemStyle: {
            color: NODE_COLOR[n.type],
            shadowBlur: n.risk > 50 ? 18 : 8,
            shadowColor: n.risk > 50 ? `${t.colors.danger}99` : NODE_COLOR[n.type],
            borderColor: t.colors.edge,
            borderWidth: 1,
          },
        })),
        links: graph.links.map((l) => ({
          source: l.source,
          target: l.target,
          label: { show: true, formatter: l.label, color: t.colors.textDim, fontSize: 10 },
          lineStyle: {
            color: l.risk ? t.colors.danger : `${t.colors.accent}59`,
            width: l.risk ? 2.5 : 1.2,
            curveness: 0.12,
            shadowBlur: l.risk ? 8 : 0,
            shadowColor: t.colors.danger,
          },
        })),
        emphasis: { focus: 'adjacency' },
      },
    ],
  }
  return <EChart option={option} height={height} theme={mode} />
}
