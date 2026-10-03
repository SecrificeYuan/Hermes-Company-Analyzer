// 对比页 AI 深度对比（/api/compare-ai）：summary 流式 / verdict 一句话 / dimensionNotes 五维对比。
// 与报告页同一套铁律：不编造输入数据外的数字（全数字溯源到任一家公司）、资料不足明说。
import { buildFactPayload, buildSignalPayload, assertNumbersTraceableAny } from './facts'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'
import type { ChatMessage } from './client'

export type CompareField = 'summary' | 'verdict'

export interface CompareDimensionNotes {
  hp?: string
  def?: string
  atk?: string
  morale?: string
  network?: string
}

const LAMP_LABEL: Record<CompanyXRay['overallRisk'], string> = {
  green: '绿灯', yellow: '黄灯', red: '红灯',
}

const DIMENSION_ORDER: NarrativeKey[] = ['hp', 'def', 'atk', 'morale', 'network']

const FIELD_SPEC: Record<CompareField, string> = {
  summary:
    '直接输出 markdown 正文（不要代码围栏、不要 JSON 包裹、不要小标题）。250~400 字整体归因：哪家更稳、关键差异集中在一两个什么维度、付款建议。必须点双方公司名、引用双方「维度事实」与「命中信号」中的具体数据点，禁止泛泛而谈。结尾必须包含「历史不代表未来」。',
  verdict:
    '只输出一个 JSON 对象 {"verdict": string}。verdict 是一句话（不超过 40 字），直接回答「付款给哪家更稳」，用公司名指代，不绕弯。',
}

function companyPayload(x: CompanyXRay) {
  return {
    名称: x.name,
    代码: x.stockCode ?? '非上市',
    行业: x.industry,
    灯色: LAMP_LABEL[x.overallRisk],
    风险评分: `${x.riskScore} / 100`,
    命中信号: buildSignalPayload(x),
    维度事实: buildFactPayload(x),
  }
}

const BASE_RULES = [
  '铁律一：不得出现输入数据之外的任何数字（百分数/整数/小数均须可溯源到任一家公司），不确定就说「资料不足，无法确认」。',
  '铁律二：资料不足时明说，不得编造。',
  '铁律三：直接对读者说话，不得出现「模板」「命中信号」「输入数据」等内部词汇；没有命中信号就说「未发现异常信号」。',
]

/** 构造对比页某一段的完整消息序列（A/B 双方事实同帧喂入）。 */
export function buildCompareMessages(a: CompanyXRay, b: CompanyXRay, field: CompareField): ChatMessage[] {
  const system = [
    '你是严谨的金融风险对比分析助手，给非专业读者写人话对比。',
    `正在对比两家公司：A=${a.name}，B=${b.name}；用户场景是「付款前核对：这钱付给哪家更稳」。`,
    FIELD_SPEC[field],
    ...BASE_RULES,
  ].join('\n')

  const user = JSON.stringify({
    场景: '付款前核对：这钱付给哪家更稳',
    A: companyPayload(a),
    B: companyPayload(b),
    综合差值: {
      风险评分: `A ${a.riskScore} vs B ${b.riskScore}（低者更稳）`,
      基本面健康度: `A ${a.hp.score} vs B ${b.hp.score}`,
      偿债安全垫: `A ${a.def.score} vs B ${b.def.score}`,
      稳健度: `A ${100 - a.riskScore} vs B ${100 - b.riskScore}`,
    },
    数据基准日: { A: a.asOf, B: b.asOf },
  })

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** dimensionNotes 独立构造：五维对比一次性 JSON（并行生成用） */
export function buildCompareDimensionNotesMessages(a: CompanyXRay, b: CompanyXRay): ChatMessage[] {
  const system = [
    '你是严谨的金融风险对比分析助手，给非专业读者写人话对比。',
    `正在对比两家公司：A=${a.name}，B=${b.name}。`,
    '只输出一个 JSON 对象 {"dimensionNotes": object}，object 的键只能是 hp（财务健康）/ def（股权质押）/ atk（涉诉）/ morale（舆情）/ network（关联网络），每个值 80~150 字：说清该维度谁占优、引用该维度双方「维度事实」中的具体数据点做依据；「维度事实」标注「尚未取回」的维度才写「资料不足，无法确认」，其余维度禁止写「资料不足」。',
    ...BASE_RULES,
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ A: companyPayload(a), B: companyPayload(b) }) },
  ]
}

/** 解析并守卫对比某一段：JSON 结构校验 + 全数字溯源（两家公司的数字均合法）。 */
export function parseCompareInsight(
  field: CompareField,
  raw: string | null,
  a: CompanyXRay,
  b: CompanyXRay,
): string | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  const v = obj[field]
  if (typeof v !== 'string' || !v.trim()) return null
  const t = v.trim()
  if (!assertNumbersTraceableAny(t, [a, b])) return null
  return t
}

/** 解析五维对比短评：每维独立全数字溯源，坏维度丢弃。 */
export function parseCompareDimensionNotes(
  raw: string | null,
  a: CompanyXRay,
  b: CompanyXRay,
): CompareDimensionNotes | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const notes = (parsed as Record<string, unknown>).dimensionNotes
  if (!notes || typeof notes !== 'object') return null
  const out: CompareDimensionNotes = {}
  for (const k of DIMENSION_ORDER) {
    const v = (notes as Record<string, unknown>)[k]
    if (typeof v !== 'string' || !v.trim()) continue
    const t = v.trim()
    if (!assertNumbersTraceableAny(t, [a, b])) continue
    out[k] = t
  }
  return Object.keys(out).length ? out : null
}
