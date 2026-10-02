import type { CompanyXRay, RawCompanyData } from '@/lib/types'
import { SEVERITY_WEIGHT } from '@/lib/types'
import { scoreHp } from './scoring/hp'
import { scoreDefense } from './scoring/defense'
import { scoreAttack } from './scoring/attack'
import { scoreMorale } from './scoring/morale'
import { detectHiddenStatus } from './debuff/rules'
import { buildTimeline } from './timeline'
import { buildGraph } from './graph'
import { buildVerdict } from './verdict'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

/**
 * 分析引擎主入口 —— 纯函数，输入 RawCompanyData 输出 CompanyXRay，不依赖任何网络。
 *
 * asOf 默认锚定数据抓取时间（meta.fetchedAt），保证 mock 演示结果可复现；
 * 生产环境可显式传入 new Date() 以真实当下计算"近 N 天"窗口。
 */
export function analyze(raw: RawCompanyData, asOf = new Date(raw.meta.fetchedAt)): CompanyXRay {
  const hp = scoreHp(raw.financial)
  const def = scoreDefense(raw)
  const atk = scoreAttack(raw.legal)
  const morale = scoreMorale(raw.sentiment, asOf)

  const hiddenStatus = detectHiddenStatus(raw, asOf)
  const debuffPenalty = Math.min(20, hiddenStatus.reduce((s, d) => s + SEVERITY_WEIGHT[d.severity], 0))

  // 综合风险分：四维加权的补数 + debuff 惩罚
  const composite = hp.score * 0.35 + def.score * 0.25 + (100 - atk.score) * 0.15 + morale.score * 0.25
  const riskScore = Math.round(clamp(100 - composite + debuffPenalty))
  const overallRisk = riskScore < 35 ? 'green' : riskScore < 65 ? 'yellow' : 'red'

  const { verdict, advice } = buildVerdict({
    industry: raw.meta.industry,
    hp: hp.score,
    def: def.score,
    overallRisk,
    hiddenStatus,
  })

  return {
    id: raw.meta.id,
    name: raw.meta.name,
    stockCode: raw.meta.stockCode,
    industry: raw.meta.industry,
    asOf: raw.meta.fetchedAt,
    generatedAt: new Date().toISOString(),
    overallRisk,
    riskScore,
    hp,
    def,
    atk,
    morale,
    hiddenStatus,
    timeline: buildTimeline(raw, asOf),
    graph: buildGraph(raw, riskScore),
    verdict,
    advice,
    registry: raw.meta.registry,
    llm: raw.llm,
    sources: raw.meta.sources,
  }
}
