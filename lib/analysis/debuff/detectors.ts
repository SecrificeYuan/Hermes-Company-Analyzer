import type { Lawsuit, PersonEvent, RawCompanyData, SentimentItem } from '@/lib/types'

const DAY_MS = 24 * 3600 * 1000

export function withinDays(date: string, asOf: Date, days: number): boolean {
  const t = new Date(date).getTime()
  const anchor = asOf.getTime()
  return Number.isFinite(t) && Number.isFinite(anchor) && t <= anchor && anchor - t <= days * DAY_MS
}

/** 近 N 天诉讼（默认被告才算风险，原告维权不算） */
export function recentLawsuits(raw: RawCompanyData, days: number, asOf: Date): Lawsuit[] {
  return (raw.legal?.lawsuits ?? []).filter((l) => l.role === '被告' && withinDays(l.date, asOf, days))
}

/** 近 N 天减持事件（金额 > threshold 万元） */
export function cashoutEvents(raw: RawCompanyData, asOf: Date, days = 365, threshold = 1000): PersonEvent[] {
  return (raw.people ?? []).filter(
    (p) => p.event === '减持' && (p.amount ?? 0) > threshold && withinDays(p.date, asOf, days),
  )
}

/** 质押事件（amount 即累计质押比例 %） */
export function pledgeEvents(raw: RawCompanyData): PersonEvent[] {
  return (raw.people ?? []).filter((p) => p.event === '质押')
}

/** 供应链相关诉讼：供应商/施工方追讨货款、工程款 */
const SUPPLIER_CAUSE = /货款|供应|买卖合同|工程款|施工/

export function supplierLawsuits(raw: RawCompanyData): Lawsuit[] {
  return (raw.legal?.lawsuits ?? []).filter((l) => l.role === '被告' && SUPPLIER_CAUSE.test(l.cause))
}

/** 欠薪/停工类舆情信号 */
const PAYROLL_KEYWORD = /欠薪|讨薪|拖欠工资|裁员|停工/

export function payrollSignals(raw: RawCompanyData, asOf: Date, days = 180): SentimentItem[] {
  return (raw.sentiment ?? []).filter(
    (s) => PAYROLL_KEYWORD.test(s.headline) && withinDays(s.date, asOf, days),
  )
}
