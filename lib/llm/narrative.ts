// 叙事层：行动建议 + 报告页/对比页 AI 点评的消息构造与解析守卫。
// 铁律：不得编造输入数据外的数字；资料不足必须明说；caveat 必须含「历史不代表未来」。
// 守卫：全数字溯源（百分数/整数/小数都必须出自喂料事实）。
import type { CompanyXRay, NarrativeKey } from '@/lib/types'
import type { ChatMessage } from './client'
import {
  buildFactPayload,
  buildSignalPayload,
  assertNumbersTraceable,
  assertNumbersTraceableAny,
} from './facts'

export const LAMP_LABEL: Record<CompanyXRay['overallRisk'], string> = {
  green: '绿灯', yellow: '黄灯', red: '红灯',
}

/** 全量喂料 user payload（点评/对比/行动建议共用骨架） */
export function buildUserPayload(xray: CompanyXRay): Record<string, unknown> {
  return {
    公司: xray.name,
    行业: xray.industry,
    灯色: LAMP_LABEL[xray.overallRisk],
    血条: `${xray.hp.score}%`,
    护甲: `${xray.def.score}%`,
    风险评分: xray.riskScore,
    命中信号: buildSignalPayload(xray),
    维度事实: buildFactPayload(xray),
    模板结论: xray.verdict,
    数据基准日: xray.asOf,
  }
}

const BASE_RULES = [
  '铁律一：不得出现输入数据之外的任何数字（百分数/整数/小数均须可溯源），不确定就说「资料不足，无法确认」。',
  '铁律二：资料不足时明说，不得编造。',
  '铁律三：直接对读者说话，不得出现「模板」「命中信号」「输入数据」等内部词汇；没有命中信号就说「未发现异常信号」。',
]

/** 构造行动建议的完整消息序列（system 立规矩 + user 喂面板数据）。 */
export function buildActionAdviceMessages(xray: CompanyXRay, scenario: string): ChatMessage[] {
  const lamp = LAMP_LABEL[xray.overallRisk]
  const system = [
    '你是严谨的金融风险提示助手。只输出一个 JSON 对象，格式为 {"scenario": string, "items": string[], "caveat": string}，不要输出任何其他文字。',
    `用户场景是「${scenario}」，当前灯色为${lamp}。`,
    'items 必须给出 3 到 5 条可立即执行的行动项，每条一句话、具体到动作。',
    xray.overallRisk === 'green'
      ? '绿灯语义：这是付款前的核对清单，逐项确认再行动。'
      : xray.overallRisk === 'yellow'
        ? '黄灯语义：给出怎么付更安全的具体做法（限额、分期、留证据等）。'
        : '红灯语义：给出止损与替代方案，并明确哪些动作不要做。',
    '行动项必须引用「维度事实」与「命中信号」中的具体数据点，禁止泛泛而谈。',
    ...BASE_RULES,
    '铁律四：caveat 必须包含「历史不代表未来」。',
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ ...buildUserPayload(xray), 场景: scenario }) },
  ]
}

// 报告页 AI 点评（/api/report-ai）：summary 流式长文 / lightReason 一句话 / sectionNotes 五维短评。
// 短字段 JSON 完成即推；summary markdown 真流式，无 JSON 包裹。
export type InsightField = 'summary' | 'lightReason'

export interface InsightSectionNotes {
  hp?: string
  def?: string
  atk?: string
  morale?: string
  network?: string
}

const INSIGHT_FIELD_SPEC: Record<InsightField, string> = {
  summary:
    '直接输出 markdown 正文（不要代码围栏、不要 JSON 包裹、不要小标题）。200~350 字整体点评：说人话，面向付款前核对的非专业读者——这家公司能不能放心打交道、最需要注意哪一点、建议怎么做。必须引用「维度事实」与「命中信号」中的具体数据，禁止泛泛而谈。结尾必须包含「历史不代表未来」。',
  lightReason:
    '只输出一个 JSON 对象 {"lightReason": string}。lightReason 是一句话（不超过 40 字），直白解释为什么是这盏灯，不堆术语、不出现数字。',
}

/** 构造报告页 AI 点评某一段的完整消息序列。 */
export function buildInsightMessages(xray: CompanyXRay, field: InsightField): ChatMessage[] {
  const lamp = LAMP_LABEL[xray.overallRisk]
  const system = [
    '你是严谨的金融风险提示助手，给非专业读者写人话点评。',
    `用户场景是「付款前核对」，当前灯色为${lamp}。`,
    INSIGHT_FIELD_SPEC[field],
    ...BASE_RULES,
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(buildUserPayload(xray)) },
  ]
}

/** sectionNotes 独立构造：五维短评一次性 JSON（并行生成用） */
export function buildSectionNotesMessages(xray: CompanyXRay): ChatMessage[] {
  const lamp = LAMP_LABEL[xray.overallRisk]
  const system = [
    '你是严谨的金融风险提示助手，给非专业读者写人话点评。',
    `用户场景是「付款前核对」，当前灯色为${lamp}。`,
    '只输出一个 JSON 对象 {"sectionNotes": object}，object 的键只能是 hp（财务健康）/ def（股权质押）/ atk（涉诉）/ morale（舆情）/ network（关联网络），每个值是 80~150 字的分维度短评，人话、引用该维度「维度事实」中的具体数据点，只点该维度最值得注意的一点；「维度事实」标注「尚未取回」的值才写「资料不足，无法确认」，其余维度禁止写「资料不足」。',
    ...BASE_RULES,
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(buildUserPayload(xray)) },
  ]
}

/** 解析并守卫某一段点评：JSON 结构校验 + 全数字溯源校验。 */
export function parseInsight(
  field: InsightField,
  raw: string | null,
  xray: CompanyXRay,
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
  if (!assertNumbersTraceable(t, xray)) return null
  return t
}

/** 解析五维短评：每维独立做全数字溯源，坏维度丢弃不拖垮其余。 */
export function parseSectionNotes(
  raw: string | null,
  xray: CompanyXRay,
): InsightSectionNotes | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const notes = (parsed as Record<string, unknown>).sectionNotes
  if (!notes || typeof notes !== 'object') return null
  const out: InsightSectionNotes = {}
  for (const k of ['hp', 'def', 'atk', 'morale', 'network'] as const) {
    const v = (notes as Record<string, unknown>)[k]
    if (typeof v !== 'string' || !v.trim()) continue
    const t = v.trim()
    if (!assertNumbersTraceable(t, xray)) continue
    out[k] = t
  }
  return Object.keys(out).length ? out : null
}

/**
 * 解析并守卫行动建议。xray 传入时启用全数字溯源校验。
 */
export function parseActionAdvice(
  raw: string,
  model: string,
  xray?: CompanyXRay,
): NonNullable<CompanyXRay['nextSteps']> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  const scenario = obj.scenario
  const items = obj.items
  if (typeof scenario !== 'string' || !scenario.trim()) return null
  const caveat = typeof obj.caveat === 'string' && obj.caveat.trim() ? obj.caveat.trim() : '历史不代表未来'
  if (!Array.isArray(items)) return null
  if (items.length < 3 || items.length > 5) return null
  if (!items.every((it) => typeof it === 'string' && it.trim())) return null
  if (xray && !items.every((it) => assertNumbersTraceable(it as string, xray))) return null

  return {
    scenario: scenario.trim(),
    items: (items as string[]).map((it) => it.trim()),
    caveat: caveat.trim(),
    generatedAt: new Date().toISOString(),
    model,
  }
}

// ── 兼容导出（旧调用点 get-xray.ts 仍引用） ─────────────────────
/** @deprecated 用 assertNumbersTraceable 替代 */
export function assertPercentTraceable(text: string, xray: CompanyXRay): boolean {
  return assertNumbersTraceable(text, xray)
}
/** @deprecated 用 assertNumbersTraceableAny 替代 */
export function assertPercentTraceableAny(text: string, xrays: CompanyXRay[]): boolean {
  return assertNumbersTraceableAny(text, xrays)
}
