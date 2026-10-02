import type { CompanyXRay } from '@/lib/types'

/** 最小可用的 CompanyXRay 工厂：各维度取中性分，测试中按需 overrides。 */
export function makeXray(overrides: Partial<CompanyXRay> = {}): CompanyXRay {
  return {
    id: 't', name: '测试', industry: '测试', generatedAt: '', asOf: '',
    overallRisk: 'yellow', riskScore: 50,
    hp: { score: 50, label: '', cashFlow: 0, debtRatio: 50, trend: [] },
    def: { score: 50, label: '', pledgeRatio: 10, assetCoverage: 1 },
    atk: { score: 50, label: '', lawsuitCount: 0, executionAmount: 0, available: true },
    morale: { score: 50, label: '', avgTone: 0, trend: [], available: true },
    hiddenStatus: [], timeline: [],
    graph: { nodes: [], links: [] },
    verdict: '', advice: '',
    ...overrides,
  }
}
