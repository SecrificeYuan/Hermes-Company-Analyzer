// 叙事层：亮灯后的「下一步」行动建议（NextSteps）。
// 铁律：不得编造输入数据外的数字；资料不足必须明说；caveat 必须含「历史不代表未来」。
import type { CompanyXRay } from '@/lib/types'
import type { ChatMessage } from './client'

const LAMP_LABEL: Record<CompanyXRay['overallRisk'], string> = {
  green: '绿灯', yellow: '黄灯', red: '红灯',
}

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
    '铁律一：不得出现输入数据之外的任何数字（尤其百分数），不确定就说「资料不足，无法确认」。',
    '铁律二：资料不足时明说，不得编造。',
    '铁律三：caveat 必须包含「历史不代表未来」。',
  ].join('\n')

  const user = JSON.stringify({
    公司: xray.name,
    行业: xray.industry,
    灯色: lamp,
    场景: scenario,
    血条: `${xray.hp.score}%`,
    护甲: `${xray.def.score}%`,
    命中信号: xray.hiddenStatus.map((h) => `${h.label}（${h.severity}）：${h.description}`),
    模板结论: xray.verdict,
    模板建议: xray.advice,
    数据基准日: xray.asOf,
  })

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/**
 * 解析并守卫 LLM 返回的行动建议。
 * xray 传入时启用百分数可溯源校验：条目中出现的百分数必须能在面板数据中找到出处。
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
  // caveat 缺失时回退诚实标注默认值（铁律三），不拒绝整体结果
  const caveat = typeof obj.caveat === 'string' && obj.caveat.trim() ? obj.caveat.trim() : '历史不代表未来'
  if (!Array.isArray(items)) return null
  if (items.length < 3 || items.length > 5) return null
  if (!items.every((it) => typeof it === 'string' && it.trim())) return null
  if (xray && !items.every((it) => assertPercentTraceable(it as string, xray))) return null

  return {
    scenario: scenario.trim(),
    items: (items as string[]).map((it) => it.trim()),
    caveat: caveat.trim(),
    generatedAt: new Date().toISOString(),
    model,
  }
}

/** 收集面板中可溯源的数字集合（血条/护甲分 + 命中信号证据文本中的数字）。 */
function collectTraceableNumbers(xray: CompanyXRay): Set<string> {
  const set = new Set<string>()
  set.add(String(xray.hp.score))
  set.add(String(xray.def.score))
  for (const h of xray.hiddenStatus) {
    for (const e of h.evidence ?? []) {
      for (const m of String(e.detail).matchAll(/\d+(?:\.\d+)?/g)) {
        set.add(m[0])
      }
    }
  }
  return set
}

// 报告页 AI 点评（/api/report-ai）：summary / lightReason / sectionNotes 三段独立生成，
// 每段一个小 JSON，路由按字段完成顺序推送——首段约 2 秒内到达。
// 铁律沿用：不编造输入数据外的数字（百分数可溯源）、资料不足明说。
export type InsightField = 'summary' | 'lightReason' | 'sectionNotes'

export interface InsightSectionNotes {
  hp?: string
  def?: string
  atk?: string
  morale?: string
  network?: string
}

const INSIGHT_FIELD_SPEC: Record<InsightField, string> = {
  summary:
    '只输出一个 JSON 对象 {"summary": string}。summary 是 120 字内的整体点评：说人话，面向付款前核对的非专业读者——这家公司能不能放心打交道、最需要注意哪一点。结尾必须包含「历史不代表未来」。',
  lightReason:
    '只输出一个 JSON 对象 {"lightReason": string}。lightReason 是一句话（不超过 40 字），直白解释为什么是这盏灯，不堆术语、不出现数字。',
  sectionNotes:
    '只输出一个 JSON 对象 {"sectionNotes": object}，object 的键只能是 hp（财务健康）/ def（股权质押）/ atk（涉诉）/ morale（舆情）/ network（关联网络），每个值是 40~70 字的分维度短评，人话、只点该维度最值得注意的一点；某维度数据不足时值写「资料不足，无法确认」。',
}

/** 构造报告页 AI 点评某一段的完整消息序列。 */
export function buildInsightMessages(xray: CompanyXRay, field: InsightField): ChatMessage[] {
  const lamp = LAMP_LABEL[xray.overallRisk]
  const system = [
    '你是严谨的金融风险提示助手，给非专业读者写人话点评。',
    `用户场景是「付款前核对」，当前灯色为${lamp}。`,
    INSIGHT_FIELD_SPEC[field],
    '铁律一：不得出现输入数据之外的任何数字（尤其百分数），不确定就说「资料不足，无法确认」。',
    '铁律二：资料不足时明说，不得编造。',
  ].join('\n')

  const user = JSON.stringify({
    公司: xray.name,
    行业: xray.industry,
    灯色: lamp,
    血条: `${xray.hp.score}%`,
    护甲: `${xray.def.score}%`,
    命中信号: xray.hiddenStatus.map((h) => `${h.label}（${h.severity}）`),
    模板结论: xray.verdict,
    数据基准日: xray.asOf,
  })

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/**
 * 解析并守卫某一段点评：JSON 结构校验 + 百分数可溯源校验。
 * 返回字符串（summary/lightReason）或五维短评对象（sectionNotes）；失败返回 null。
 */
export function parseInsight(
  field: InsightField,
  raw: string | null,
  xray: CompanyXRay,
): string | InsightSectionNotes | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>

  if (field === 'sectionNotes') {
    const notes = obj.sectionNotes
    if (!notes || typeof notes !== 'object') return null
    const out: InsightSectionNotes = {}
    for (const k of ['hp', 'def', 'atk', 'morale', 'network'] as const) {
      const v = (notes as Record<string, unknown>)[k]
      if (typeof v !== 'string' || !v.trim()) continue
      const t = v.trim()
      if (!assertPercentTraceable(t, xray)) return null
      out[k] = t
    }
    return Object.keys(out).length ? out : null
  }

  const v = obj[field]
  if (typeof v !== 'string' || !v.trim()) return null
  const t = v.trim()
  if (!assertPercentTraceable(t, xray)) return null
  return t
}

/**
 * 百分数可溯源守卫：文本中出现的每个百分数，其数字必须能在面板数据中找到出处
 * （血条/护甲分 + 命中信号证据文本中的数字）。无百分数视为通过。
 * 叙事层与 verdict 润色路径共用。
 */
export function assertPercentTraceable(text: string, xray: CompanyXRay): boolean {
  const legal = collectTraceableNumbers(xray)
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)%/g)) {
    if (!legal.has(m[1])) return false
  }
  return true
}
