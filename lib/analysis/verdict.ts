import type { CompanyXRay } from '@/lib/types'

export interface Verdict {
  verdict: string
  advice: string
}

/**
 * LLM 润色的边界契约。
 *
 * 分析层只定义输入、输出与回退规则，不持有 API key，也不发起网络请求。
 * 服务编排层若接入模型，必须把模板结论和可追溯证据完整传入，并要求模型原样
 * 返回 overallRisk；分数、隐藏状态和证据永远由 analyze() 的确定性结果决定。
 */
export interface VerdictRefinementRequest {
  draft: Verdict
  overallRisk: CompanyXRay['overallRisk']
  evidence: CompanyXRay['hiddenStatus']
}

export interface VerdictRefinementResponse extends Verdict {
  overallRisk: CompanyXRay['overallRisk']
}

export type VerdictRefiner = (request: Readonly<VerdictRefinementRequest>) => Promise<VerdictRefinementResponse | null>

/** 网络/模型失败、风险级别不一致或空文本时，始终回退到确定性模板。 */
export function applyVerdictRefinement(
  draft: Verdict,
  overallRisk: CompanyXRay['overallRisk'],
  candidate: VerdictRefinementResponse | null | undefined,
): Verdict {
  if (
    !candidate ||
    candidate.overallRisk !== overallRisk ||
    !candidate.verdict.trim() ||
    !candidate.advice.trim()
  ) {
    return draft
  }
  return { verdict: candidate.verdict.trim(), advice: candidate.advice.trim() }
}

/**
 * 一句话诊断 —— 模板优先（黑客松现场更稳）。
 *
 * LLM hook（可选润色）：把 verdict 模板结果 + hiddenStatus 证据喂给 LLM 改写，
 * 失败/超时必须回退到模板输出。绝不允许 LLM 改变分数与结论。
 */
export function buildVerdict(input: {
  industry: string
  hp: number
  def: number
  overallRisk: CompanyXRay['overallRisk']
  hiddenStatus: CompanyXRay['hiddenStatus']
}): Verdict {
  const { industry, hp, def, overallRisk, hiddenStatus } = input
  const top = hiddenStatus[0]
  const positiveWord = hp >= 75 ? '优等生' : hp >= 50 ? '网红新星' : '昔日明星'
  // 只写有证据支撑的风险名：前 3 条逐一点名，超出才用「等 N 项」收尾；无证据不虚构
  const named = hiddenStatus.slice(0, 3).map((h) => `「${h.label}」`).join('、')
  const riskPhrase =
    hiddenStatus.length > 3 ? `${named} 等 ${hiddenStatus.length} 项风险信号已触发` : `${named}风险信号已触发`

  if (overallRisk === 'green') {
    return {
      verdict: `典型的${industry}现金牛：血条 ${hp}%，护甲 ${def}%，未发现致命隐藏状态。`,
      advice: '基本面扎实，可作防御型配置关注；仍建议跟踪季度现金流与估值水位。',
    }
  }
  if (overallRisk === 'yellow') {
    return {
      verdict: top
        ? `表面是${industry}${positiveWord}，实际血条 ${hp}%，${riskPhrase}，需要持续跟踪。`
        : `表面是${industry}${positiveWord}，实际血条 ${hp}%、护甲 ${def}%，综合评分亮黄灯，需要持续跟踪。`,
      advice: '建议控制仓位、设置止损线，重点跟踪质押比例与减持动向，等待风险出清信号。',
    }
  }
  return {
    verdict: top
      ? `表面是${industry}${positiveWord}，实际血条 ${hp}%，${riskPhrase}，需高度警惕。`
      : `表面是${industry}${positiveWord}，实际血条 ${hp}%、护甲 ${def}%，综合评分亮红灯。`,
    advice: '不建议将储蓄投入；已持有者应考虑止损离场，远离其债务与供应链链条。',
  }
}
