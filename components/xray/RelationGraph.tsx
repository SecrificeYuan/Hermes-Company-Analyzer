'use client'

import { useEffect, useRef } from 'react'
import type { EChartsOption } from 'echarts'
import type * as echarts from 'echarts'
import { ChartEmpty, EChart } from './EChart'
import { baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay, GraphNode } from '@/lib/types'

const TYPE_LABEL: Record<GraphNode['type'], string> = {
  company: '公司',
  person: '个人',
  holder: '股东机构',
  court: '司法',
  supplier: '供应商',
  media: '舆情媒体',
}

/** 外围节点名过长时截断，悬停 tooltip 仍出全名 */
function truncate(name: string, max = 9): string {
  return name.length > max ? `${name.slice(0, max)}…` : name
}


/**
 * 关系图谱（PRO 威胁情报风）：中心公司节点固定、外围力导向环形散布；
 * 边上标签悬停才显示；节点名带暗色描边防重叠；风险边红色发光+周期性脉冲；
 * 右上角小型图例说明节点配色。
 */
export function RelationGraph({
  graph,
  centerLabel,
  height = 340,
}: {
  graph: CompanyXRay['graph']
  /** 中心公司节点的图上短名（全名走 tooltip） */
  centerLabel?: string
  height?: number
}) {
  const t = useTokens()
  const mode = useMode()
  const chartRef = useRef<echarts.ECharts | null>(null)

  const NODE_COLOR: Record<GraphNode['type'], string> = {
    company: t.colors.accent,
    person: t.colors.grape,
    holder: t.colors.safe,
    court: t.colors.danger,
    supplier: t.colors.warn,
    media: t.colors.textDim,
  }

  const centerId = graph.nodes.find((n) => n.type === 'company')?.id ?? 'company'

  /** 把中心节点钉在画布实际中心；merge 按 id 匹配，只改坐标与固定标记 */
  const pinCenter = () => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption({
      series: [{
        data: [{
          id: centerId,
          x: chart.getWidth() / 2,
          y: chart.getHeight() / 2,
          fixed: true,
        }],
      }],
    })
  }

  // 数据更新后（wrapper 会 notMerge 重建 option，fixed 标记丢失）重新钉中心
  useEffect(() => {
    const raf = requestAnimationFrame(pinCenter)
    return () => cancelAnimationFrame(raf)
  }, [graph, centerId])

  if (graph.nodes.length <= 1) return <ChartEmpty height={320} text="暂无关联实体" />

  const base = baseChartOptionFor(t)
  const option: EChartsOption = {
    ...base,
    tooltip: {
      ...base.tooltip,
      formatter: (p) => {
        const d = p as unknown as { dataType: string; data: { name?: string; full?: string; label?: unknown; nodeType?: GraphNode['type'] } }
        if (d.dataType === 'edge') return String((d.data as { label?: string }).label ?? '')
        const type = d.data.nodeType ? ` · ${TYPE_LABEL[d.data.nodeType]}` : ''
        return `${d.data.full ?? d.data.name ?? ''}${type}`
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        force: { repulsion: 340, edgeLength: [80, 140], gravity: 0.14 },
        animationDuration: 800,
        animationEasing: 'cubicOut',
        label: {
          show: true,
          position: 'bottom',
          color: t.colors.textMain,
          fontSize: 11,
          // 暗色描边打底，名字压在线上也可读
          textBorderColor: t.colors.bg,
          textBorderWidth: 3,
        },
        data: graph.nodes.map((n) => {
          const isCenter = n.type === 'company'
          const color = NODE_COLOR[n.type]
          return {
            id: n.id,
            name: isCenter && centerLabel ? centerLabel : truncate(n.name),
            full: n.name,
            nodeType: n.type,
            // 中心放大；位置在图表就绪后由 pinCenter 钉在画布中心
            ...(isCenter ? { symbolSize: 52 } : { symbolSize: 24 + n.risk * 0.2 }),
            label: isCenter ? { fontSize: 13, fontWeight: 'bold' as const } : {},
            itemStyle: {
              color,
              shadowBlur: n.risk > 50 ? 20 : 10,
              shadowColor: n.risk > 50 ? `${t.colors.danger}aa` : `${color}88`,
              borderColor: n.risk > 50 ? t.colors.danger : t.colors.edge,
              borderWidth: n.risk > 50 ? 1.5 : 1,
            },
          }
        }),
        links: graph.links.map((l) => ({
          source: l.source,
          target: l.target,
          label: {
            show: false, // 默认隐藏，悬停 emphasis 才显示，避免全图文字打架
            formatter: l.label,
            color: t.colors.textDim,
            fontSize: 10,
            backgroundColor: `${t.colors.bg}cc`,
            padding: [2, 4],
            borderRadius: 3,
          },
          emphasis: { label: { show: true } },
          lineStyle: {
            color: l.risk ? t.colors.danger : `${t.colors.accent}59`,
            width: l.risk ? 3 : 1.2,
            curveness: 0.15,
            // 风险边静态强发光：不再做脉冲——周期性 merge setOption 会重启力导向布局，
            // 表现为外围节点漂移后闪现回位、整图抖动
            shadowBlur: l.risk ? 14 : 0,
            shadowColor: l.risk ? t.colors.danger : 'transparent',
            opacity: l.risk ? 1 : undefined,
          },
        })),
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 3 },
        },
      },
    ],
  }

  const presentTypes = (['company', 'person', 'holder', 'court', 'supplier', 'media'] as const)
    .filter((type) => graph.nodes.some((n) => n.type === type))

  return (
    <div className="relative">
      <EChart
        option={option}
        height={height}
        theme={mode}
        onReady={(chart) => {
          chartRef.current = chart
          requestAnimationFrame(pinCenter)
        }}
      />
      {/* 节点配色图例（仅列出图中实际出现的类型） */}
      <div className="pointer-events-none absolute right-2 top-2 flex flex-col gap-1 rounded-md bg-ink-card/70 px-2 py-1.5">
        {presentTypes.map((type) => (
          <span key={type} className="flex items-center gap-1.5 font-mono text-[9px] tracking-wider text-slate-500">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: NODE_COLOR[type], boxShadow: `0 0 6px ${NODE_COLOR[type]}` }}
            />
            {TYPE_LABEL[type]}
          </span>
        ))}
      </div>
    </div>
  )
}
