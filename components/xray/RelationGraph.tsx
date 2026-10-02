'use client'

import { useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
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
 * 关系图谱（对齐 ECharts 官方 graph-force 示例）：
 * 标准力导向布局，不做任何外部坐标干预——每次 setOption 都重建布局是"抽搐"的根源，
 * 所以 option 必须 useMemo 缓存，仅数据/主题变化时才重新 setOption。
 * 边上标签悬停才显示；节点名暗色描边防重叠；风险边静态红色发光；右上角小型图例。
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
  const [view, setView] = useState<'graph' | 'sankey'>('graph')

  const NODE_COLOR: Record<GraphNode['type'], string> = {
    company: t.colors.accent,
    person: t.colors.grape,
    holder: t.colors.safe,
    court: t.colors.danger,
    supplier: t.colors.warn,
    media: t.colors.textDim,
  }

  const option = useMemo<EChartsOption>(() => {
    const base = baseChartOptionFor(t)
    return {
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
          // 与官方示例同款参数域：斥力、边长区间、向心重力
          force: { repulsion: 300, edgeLength: [80, 150], gravity: 0.1 },
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
              symbolSize: isCenter ? 52 : 24 + n.risk * 0.2,
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
              curveness: 0, // 直线边；>0 会变贝塞尔曲线
              shadowBlur: l.risk ? 14 : 0,
              shadowColor: l.risk ? t.colors.danger : 'transparent',
            },
          })),
          emphasis: {
            focus: 'adjacency',
            lineStyle: { width: 3 },
          },
          // 布局只在 option 重建时重跑一次；入场动画由 ECharts 原生提供
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
      ],
    }
  }, [graph, t, centerLabel])

  /** 桑基图：星型股权/风险流向，外围 → 公司。带宽取链路标签里的数值（持股 % 或涉诉起数），无量纲的记 1 */
  const sankeyOption = useMemo<EChartsOption>(() => {
    const base = baseChartOptionFor(t)
    // sankey 以 name 关联，需全局唯一——撞名加序号
    const nameOf = new Map<string, string>()
    const counts = new Map<string, number>()
    const nodes = graph.nodes.map((n) => {
      let name = truncate(n.name, 12)
      const c = counts.get(name) ?? 0
      counts.set(name, c + 1)
      if (c > 0) name = `${name}·${c + 1}`
      nameOf.set(n.id, name)
      return {
        name,
        depth: n.type === 'company' ? 1 : 0,
        itemStyle: { color: NODE_COLOR[n.type], borderColor: 'transparent' },
      }
    })
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        formatter: (p) => {
          const d = p as unknown as { dataType?: string; data: { name?: string; label?: string; value?: number } }
          if (d.dataType === 'edge') return `${d.data.label ?? ''}（${d.data.value}）`
          return String(d.data.name ?? '')
        },
      },
      series: [
        {
          type: 'sankey',
          left: 12,
          right: 120,
          top: 12,
          bottom: 12,
          nodeWidth: 12,
          nodeGap: 10,
          layoutIterations: 64,
          emphasis: { focus: 'adjacency' },
          data: nodes,
          links: graph.links.map((l) => {
            const m = l.label.match(/([\d.]+)\s*%/) ?? l.label.match(/(\d+)\s*起/)
            return {
              source: nameOf.get(l.source) ?? l.source,
              target: nameOf.get(l.target) ?? l.target,
              value: m ? parseFloat(m[1]) : 1,
              label: l.label,
              lineStyle: { color: l.risk ? t.colors.danger : 'gradient', opacity: l.risk ? 0.55 : 0.3 },
            }
          }),
          label: {
            color: t.colors.textMain,
            fontSize: 11,
            textBorderColor: t.colors.bg,
            textBorderWidth: 3,
          },
          lineStyle: { curveness: 0.5 },
        },
      ],
    }
  }, [graph, t])

  if (graph.nodes.length <= 1) return <ChartEmpty height={320} text="暂无关联实体" />

  const presentTypes = (['company', 'person', 'holder', 'court', 'supplier', 'media'] as const)
    .filter((type) => graph.nodes.some((n) => n.type === type))

  return (
    <div className="relative">
      {/* 视图切换：网络图 / 桑基图 */}
      <div className="absolute left-2 top-2 z-10 flex gap-0.5 rounded-md bg-ink-card/70 p-0.5">
        {([['graph', '网络图'], ['sankey', '桑基图']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`rounded px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
              view === key ? 'bg-neon/20 text-neon' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <EChart option={view === 'graph' ? option : sankeyOption} height={height} theme={mode} />
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
