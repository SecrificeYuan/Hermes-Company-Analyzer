import type { CompanyXRay, GraphLink, GraphNode, RawCompanyData } from '@/lib/types'
import { supplierLawsuits } from './debuff/detectors'

/**
 * 关系图谱：以公司为中心，把高管、法院、供应商、媒体挂上来。
 * 被标记风险的人物/机构连红边（link.risk = true）。
 *
 * TODO(feat/analysis-engine)：接入真实股东/对外投资数据后，扩展多层股权穿透。
 */
export function buildGraph(raw: RawCompanyData, riskScore: number): CompanyXRay['graph'] {
  const nodes: GraphNode[] = [{ id: 'company', name: raw.meta.name, type: 'company', risk: riskScore }]
  const links: GraphLink[] = []

  for (const p of raw.people ?? []) {
    const id = `person:${p.name}`
    const risky = p.event === '减持' || p.event === '质押' || p.event === '离职'
    nodes.push({ id, name: p.name, type: 'person', risk: risky ? 75 : 15 })
    links.push({ source: id, target: 'company', label: `${p.role}·${p.event}`, risk: risky })
  }

  // 十大股东挂机构节点（前 8 个，避免小股东糊满图）；持股超 30% 标风险边
  for (const holder of (raw.shareholders ?? []).slice(0, 8)) {
    const id = `holder:${holder.name}`
    nodes.push({ id, name: holder.name, type: 'holder', risk: holder.ratio > 30 ? 55 : 15 })
    links.push({
      source: id,
      target: 'company',
      label: `持股 ${holder.ratio}%${holder.isInstitution ? '' : ' · 个人'}`,
      risk: holder.ratio > 30,
    })
  }

  const defendantCount = (raw.legal?.lawsuits ?? []).filter((l) => l.role === '被告').length
  if (defendantCount > 0 || (raw.legal?.executions.length ?? 0) > 0) {
    nodes.push({ id: 'court', name: '司法系统', type: 'court', risk: 70 })
    links.push({ source: 'court', target: 'company', label: `涉诉 ${defendantCount} 起`, risk: true })
  }

  const supplierCount = supplierLawsuits(raw).length
  if (supplierCount > 0) {
    nodes.push({ id: 'suppliers', name: '供应商群体', type: 'supplier', risk: 65 })
    links.push({ source: 'suppliers', target: 'company', label: `追讨货款 ${supplierCount} 起`, risk: true })
  }

  // 舆情来源挂媒体节点（取最近 3 个来源）
  const mediaSources = [...new Set((raw.sentiment ?? []).slice(-6).map((s) => s.source))].slice(0, 3)
  const avgRecentTone =
    (raw.sentiment ?? []).slice(-6).reduce((s, x) => s + x.tone, 0) / Math.max(1, (raw.sentiment ?? []).slice(-6).length)
  for (const source of mediaSources) {
    const id = `media:${source}`
    nodes.push({ id, name: source, type: 'media', risk: avgRecentTone < -3 ? 60 : 20 })
    links.push({ source: id, target: 'company', label: '报道', risk: avgRecentTone < -3 })
  }

  return { nodes, links }
}
