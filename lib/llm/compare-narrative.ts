// 对比页 AI 深度对比（/api/compare-ai）：summary / verdict / dimensionNotes 三段独立生成，
// 与报告页点评同一套铁律：不编造输入数据外的数字（百分数可溯源到任一家公司）、
// 资料不足明说、直接对读者说话、不出现内部词汇。
import { dimensionFacts, assertPercentTraceableAny } from './narrative'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'
import type { ChatMessage } from './client'

export type CompareField = 'summary' | 'verdict' | 'dimensionNotes'

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
    '只输出一个 JSON 对象 {"summary": string}。summary 是 150 字内的整体归因：哪家更稳、关键差异集中在一两个什么维度、付款建议。必须点双方公司名，结尾必须包含「历史不代表未来」。',
  verdict:
    '只输出一个 JSON 对象 {"verdict": string}。verdict 是一句话（不超过 40 字），直接回答「付款给哪家更稳」，用公司名指代，不绕弯。',
  dimensionNotes:
    '只输出一个 JSON 对象 {"dimensionNotes": object}，object 的键只能是 hp（财务健康）/ def（股权质押）/ atk（涉诉）/ morale（舆情）/ network（关联网络），每个值 40~70 字：说清该维度谁占优、依据是什么；「双方对比事实」里标注「尚未取回」的维度才写「资料不足，无法确认」，其余维度禁止写「资料不足」。',
}

/** 构造对比页某一段的完整消息序列（A/B 双方事实同帧喂入）。 */
export function buildCompareMessages(a: CompanyXRay, b: CompanyXRay, field: CompareField): ChatMessage[] {
  const system = [
    '你是严谨的金融风险对比分析助手，给非专业读者写人话对比。',
    `正在对比两家公司：A=${a.name}，B=${b.name}；用户场景是「付款前核对：这钱付给哪家更稳」。`,
    FIELD_SPEC[field],
    '铁律一：不得出现输入数据之外的任何数字（尤其百分数），不确定就说「资料不足，无法确认」。',
    '铁律二：资料不足时明说，不得编造。',
    '铁律三：直接对读者说话，不得出现「模板」「命中信号」「输入数据」等内部词汇；没有命中信号就说「未发现异常信号」。',
  ].join('\n')

  const user = JSON.stringify({
    场景: '付款前核对：这钱付给哪家更稳',
    A: {
      名称: a.name,
      代码: a.stockCode ?? '非上市',
      行业: a.industry,
      灯色: LAMP_LABEL[a.overallRisk],
      风险评分: `${a.riskScore} / 100`,
      命中信号: a.hiddenStatus.length
        ? a.hiddenStatus.map((h) => `${h.label}（${h.severity}）`)
        : '未发现异常信号',
      维度事实: dimensionFacts(a),
    },
    B: {
      名称: b.name,
      代码: b.stockCode ?? '非上市',
      行业: b.industry,
      灯色: LAMP_LABEL[b.overallRisk],
      风险评分: `${b.riskScore} / 100`,
      命中信号: b.hiddenStatus.length
        ? b.hiddenStatus.map((h) => `${h.label}（${h.severity}）`)
        : '未发现异常信号',
      维度事实: dimensionFacts(b),
    },
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

/**
 * 解析并守卫对比某一段：JSON 结构校验 + 百分数可溯源（两家公司的数字均合法）。
 * 返回字符串（summary/verdict）或五维对比短评对象（dimensionNotes）；失败返回 null。
 */
export function parseCompareInsight(
  field: CompareField,
  raw: string | null,
  a: CompanyXRay,
  b: CompanyXRay,
): string | CompareDimensionNotes | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>

  if (field === 'dimensionNotes') {
    const notes = obj.dimensionNotes
    if (!notes || typeof notes !== 'object') return null
    const out: CompareDimensionNotes = {}
    for (const k of DIMENSION_ORDER) {
      const v = (notes as Record<string, unknown>)[k]
      if (typeof v !== 'string' || !v.trim()) continue
      const t = v.trim()
      if (!assertPercentTraceableAny(t, [a, b])) return null
      out[k] = t
    }
    return Object.keys(out).length ? out : null
  }

  const v = obj[field]
  if (typeof v !== 'string' || !v.trim()) return null
  const t = v.trim()
  if (!assertPercentTraceableAny(t, [a, b])) return null
  return t
}
