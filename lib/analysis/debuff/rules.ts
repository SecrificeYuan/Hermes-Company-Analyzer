import type { HiddenStatus, RawCompanyData, Severity } from '@/lib/types'
import { cashoutEvents, payrollSignals, pledgeEvents, recentLawsuits, supplierLawsuits } from './detectors'

type Evidence = HiddenStatus['evidence']

interface DebuffRule {
  id: string
  label: string
  severity: Severity
  description: string
  /** 返回触发证据；空数组/null = 不触发。没有证据就不触发，这是可信度底线。 */
  detect(raw: RawCompanyData, asOf: Date): Evidence | null
}

/**
 * 隐藏状态规则引擎 —— 产品的灵魂。
 * 新增规则 = 往数组里加一项，analyze() 自动收集。
 */
export const RULES: DebuffRule[] = [
  {
    id: 'boss-cashout',
    label: '老板套现',
    severity: 'high',
    description: '近 12 个月高管或大股东累计减持超千万元，利益与公司长期价值脱钩',
    detect(raw, asOf) {
      const events = cashoutEvents(raw, asOf)
      if (events.length === 0) return null
      return events.map((p) => ({
        source: '高管动向',
        date: p.date,
        detail: `${p.name}（${p.role}）减持约 ${p.amount} 万元`,
      }))
    },
  },
  {
    id: 'pledge-pierce',
    label: '股权质押穿透',
    severity: 'high',
    description: '控股股东质押比例超 70%，股价下跌可能引发平仓与控制权旁落',
    detect(raw) {
      const events = pledgeEvents(raw).filter((p) => (p.amount ?? 0) >= 70)
      if (events.length === 0) return null
      return events.map((p) => ({
        source: '股权质押',
        date: p.date,
        detail: `${p.name}（${p.role}）累计质押比例达 ${p.amount}%`,
      }))
    },
  },
  {
    id: 'lawsuit-storm',
    label: '诉讼风暴',
    severity: 'high',
    description: '近 180 天作为被告涉诉 ≥5 起，法律风险呈爆发态势',
    detect(raw, asOf) {
      const lawsuits = recentLawsuits(raw, 180, asOf)
      if (lawsuits.length < 5) return null
      return lawsuits.map((l) => ({
        source: '司法涉诉',
        date: l.date,
        detail: `作为被告：${l.cause}，涉案 ${l.amount} 万元`,
      }))
    },
  },
  {
    id: 'supplier-revolt',
    label: '供应商反水',
    severity: 'mid',
    description: '供应商/施工方密集起诉追讨货款，产业链信任正在瓦解',
    detect(raw) {
      const lawsuits = supplierLawsuits(raw)
      if (lawsuits.length < 3) return null
      return lawsuits.map((l) => ({
        source: '司法涉诉',
        date: l.date,
        detail: `${l.cause}，涉案 ${l.amount} 万元`,
      }))
    },
  },
  {
    id: 'payroll-crisis',
    label: '欠薪疑云',
    severity: 'mid',
    description: '舆情多次出现欠薪/停工信号，内部经营或已失血',
    detect(raw, asOf) {
      const signals = payrollSignals(raw, asOf)
      if (signals.length < 2) return null
      return signals.map((s) => ({
        source: s.source,
        date: s.date,
        detail: s.headline,
      }))
    },
  },
]

/** 执行全部规则，按 severity 排序（high 在前） */
export function detectHiddenStatus(raw: RawCompanyData, asOf: Date): HiddenStatus[] {
  const rank: Record<Severity, number> = { high: 0, mid: 1, low: 2 }
  const results: HiddenStatus[] = []
  for (const rule of RULES) {
    const evidence = rule.detect(raw, asOf)
    if (!evidence || evidence.length === 0) continue
    results.push({
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      description: rule.description,
      evidence,
    })
  }
  return results.sort((a, b) => rank[a.severity] - rank[b.severity])
}
