import { deriveLight, type Coverage } from '@/lib/analysis/light'
import type { CompanyHealth } from '@/lib/company'
import type { CompanyXRay, TimelineEvent } from '@/lib/types'

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)))

function timeline(report: CompanyHealth): TimelineEvent[] {
  return report.announcements.slice(0, 50).map((notice) => ({ date: notice.date, event: notice.title, category: /诉讼|仲裁|执行|失信/.test(notice.title) ? 'legal' : /盈利|年报|财务|审计/.test(notice.title) ? 'finance' : 'sentiment', severity: /诉讼|仲裁|执行|失信/.test(notice.title) ? 'mid' : 'low' }))
}

/** Uses the exact CompanyXRay contract so unlisted reports render in XrayClient too. */
export function healthToXray(report: CompanyHealth): CompanyXRay {
  const { company, metrics, years } = report
  const hpScore = report.financialRisk === 'low' ? 72 : report.financialRisk === 'medium' ? 48 : report.financialRisk === 'high' ? 25 : 50
  const defScore = metrics.pledgeRatio === null ? 50 : clamp(100 - metrics.pledgeRatio * 0.7 - Math.max(0, (metrics.debtRatio ?? 0) - 70) * 1.5)
  const atkScore = metrics.lawsuitAnnouncements === null ? 50 : clamp(metrics.lawsuitAnnouncements * 5 + Math.log10(1 + Math.max(0, metrics.executionAnnouncements ?? 0)) * 10)
  const risk = report.financialRisk === 'high' ? 'red' : report.financialRisk === 'low' ? 'green' : 'yellow'
  const riskScore = report.financialRisk === 'high' ? 75 : report.financialRisk === 'low' ? 35 : 50
  const sourceStatuses = report.sources.map((source) => ({ name: 'public_web' as const, ok: source.state === 'ok', fallback: false, latencyMs: 0 }))
  return {
    id: company.id, name: company.fullName ?? company.name, industry: company.industry ?? '行业待核实', generatedAt: new Date().toISOString(), asOf: report.asOf,
    overallRisk: risk, riskScore,
    hp: { score: hpScore, label: report.financialRisk ? `财务风险${report.financialRisk === 'low' ? '较低' : report.financialRisk === 'medium' ? '中等' : '较高'}` : '数据不足', cashFlow: metrics.operatingCashFlow ?? 0, debtRatio: metrics.debtRatio ?? 0, trend: years.map((year) => year.operatingCashFlow), labels: years.map((year) => year.year) },
    def: { score: defScore, label: metrics.pledgeRatio === null ? '数据不足' : '护甲状态待核实', pledgeRatio: metrics.pledgeRatio ?? 0, assetCoverage: metrics.debtRatio === null ? 0 : clamp(100 - metrics.debtRatio) },
    atk: { score: atkScore, label: metrics.lawsuitAnnouncements === null ? '数据不足' : '公开公告线索', lawsuitCount: metrics.lawsuitAnnouncements ?? 0, executionAmount: 0 },
    morale: { score: 50, label: '数据不足', avgTone: 0, trend: [] }, hiddenStatus: [], timeline: timeline(report), graph: { nodes: [{ id: company.id, name: company.fullName ?? company.name, type: 'company', risk: riskScore }], links: [] },
    verdict: report.financialRisk === null ? '公开资料不足，当前只能确认企业线索与少量主体信息；缺失数据不会被当作低风险。' : report.riskReasons.join('；'), advice: report.investment.reason,
    light: deriveLight({
      overallRisk: risk,
      hiddenStatus: [],
      coverage: (report.overall === 'partial' ? 'partial' : 'insufficient') as Coverage,
    }),
    sources: sourceStatuses, detail: { financialYears: years, lawsuits: [], executions: [], dishonest: 0, sentimentItems: [], shareholders: [], announcements: report.announcements, people: [] }, narrative: 'balanced',
  }
}
