import type { CompanyXRay } from '@/lib/types'

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
}): { verdict: string; advice: string } {
  const { industry, hp, def, overallRisk, hiddenStatus } = input
  const top = hiddenStatus[0]
  const positiveWord = hp >= 75 ? '优等生' : hp >= 50 ? '网红新星' : '昔日明星'

  if (overallRisk === 'green') {
    return {
      verdict: `典型的${industry}现金牛：血条 ${hp}%，护甲 ${def}%，未发现致命隐藏状态。`,
      advice: '基本面扎实，可作防御型配置关注；仍建议跟踪季度现金流与估值水位。',
    }
  }
  if (overallRisk === 'yellow') {
    return {
      verdict: `表面是${industry}${positiveWord}，实际血条 ${hp}%，「${top?.label ?? '多项风险'}」已触发，需要持续跟踪。`,
      advice: '建议控制仓位、设置止损线，重点跟踪质押比例与减持动向，等待风险出清信号。',
    }
  }
  return {
    verdict: `表面是${industry}${positiveWord}，实际血条 ${hp}%，「${top?.label ?? '多重暴雷'}」等 ${hiddenStatus.length} 项隐藏状态缠身。`,
    advice: '不建议将储蓄投入；已持有者应考虑止损离场，远离其债务与供应链链条。',
  }
}
