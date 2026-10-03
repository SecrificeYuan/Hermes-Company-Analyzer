// 面向 LLM 的瘦身全量 payload：五维事实 + 命中信号 + 证据文本 + verdict，
// 裁掉 graph 坐标等纯 UI 数据；JSON 结构按维度重组、明确标注数据缺口。
// 这是「内容太浅」的根治手段——LLM 只能基于喂进来的素材说话，素材越全说得越实。
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

export interface LlmFact {
  [key: string]: unknown
}

export interface LlmDimensionFacts {
  hp: LlmFact
  def: LlmFact
  atk: LlmFact
  morale: LlmFact
  network: LlmFact
}

/** 汇总某维度内值得引用的数字集合（全数字溯源守卫的出处库） */
export interface FactNumbers {
  hp: Set<string>
  def: Set<string>
  atk: Set<string>
  morale: Set<string>
  network: Set<string>
}

function collectNumbers(value: unknown, into: Set<string>): void {
  if (value == null) return
  if (typeof value === 'number') {
    if (Number.isFinite(value)) into.add(String(value))
    return
  }
  if (typeof value === 'string') {
    for (const m of value.matchAll(/\d+(?:\.\d+)?/g)) into.add(m[0])
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, into)
    return
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectNumbers(v, into)
  }
}

/** 面向 LLM 的瘦身全量事实（不含纯 UI 的坐标/布局数据）。 */
export function buildFactPayload(xray: CompanyXRay): LlmDimensionFacts {
  const riskyNodes = xray.graph.nodes.filter((n) => n.risk >= 60)
  return {
    hp: {
      评分: `${xray.hp.score}/100（${xray.hp.label}）`,
      资产负债率: `${xray.hp.debtRatio}%`,
      最近一年经营现金流: `${xray.hp.cashFlow} 万元`,
      现金流趋势: xray.hp.trend.length
        ? xray.hp.trend.map((v, i) => `${xray.hp.labels?.[i] ?? `第${i + 1}年`}:${v} 万元`).join('，')
        : '暂无历年现金流序列',
    },
    def: {
      评分: `${xray.def.score}/100（${xray.def.label}）`,
      质押比例: `${xray.def.pledgeRatio}%`,
      资产覆盖率: `${xray.def.assetCoverage}%`,
      质押数据可用: xray.def.pledgeAvailable !== false,
    },
    atk: xray.atk.available === false
      ? { 数据可用: false, 说明: '司法数据尚未取回，本维度不做判断' }
      : {
          评分: `${xray.atk.score}/100（${xray.atk.label}）`,
          涉诉件数: xray.atk.lawsuitCount,
          被执行金额: `${xray.atk.executionAmount} 万元`,
        },
    morale: xray.morale.available === false
      ? { 数据可用: false, 说明: '舆情数据尚未独立取回，本维度不做判断' }
      : {
          评分: `${xray.morale.score}/100（${xray.morale.label}）`,
          平均情绪: `${xray.morale.avgTone}/10`,
          情绪趋势: xray.morale.trend.length
            ? xray.morale.trend.map((v, i) => `${xray.morale.labels?.[i] ?? `第${i + 1}期`}:${v}`).join('，')
            : '暂无情绪序列',
        },
    network: {
      关联实体数: xray.graph.nodes.length,
      关系条数: xray.graph.links.length,
      高风险实体: riskyNodes.length,
      高风险实体名单: riskyNodes.slice(0, 5).map((n) => `${n.name}（${n.type}，风险 ${n.risk}）`),
      关系明细: xray.graph.links.slice(0, 8).map((l) => `${l.source}→${l.target}（${l.label}${l.risk ? '，高风险' : ''}）`),
    },
  }
}

/** 命中信号 + 证据文本（喂料的弹药层） */
export function buildSignalPayload(xray: CompanyXRay) {
  return xray.hiddenStatus.length
    ? xray.hiddenStatus.map((h) => ({
        信号: h.label,
        严重度: h.severity,
        说明: h.description,
        ...(h.fatal ? { 致命: true } : {}),
        ...(h.tier ? { 层数: `${h.tier.current}/${h.tier.max}` } : {}),
        证据: h.evidence.slice(0, 3).map((e) => `[${e.date}][${e.source}]${e.detail}`),
      }))
    : '未发现异常信号'
}

/** 汇总 payload 中所有合法数字（全数字溯源守卫的出处全集） */
export function collectFactNumbers(xray: CompanyXRay): Set<string> {
  const all = new Set<string>()
  const facts = buildFactPayload(xray)
  const signals = buildSignalPayload(xray)
  collectNumbers(facts, all)
  collectNumbers(signals, all)
  // 顶层关键分
  collectNumbers({ riskScore: xray.riskScore, hp: xray.hp.score, def: xray.def.score, atk: xray.atk.score, morale: xray.morale.score }, all)
  return all
}

/** 全数字溯源守卫：文本中出现的每个百分数/数字，都必须能在喂料事实中找到出处。 */
export function assertNumbersTraceable(text: string, xray: CompanyXRay): boolean {
  const legal = collectFactNumbers(xray)
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
    if (!legal.has(m[0])) return false
  }
  return true
}

/** 跨公司版：文本数字须出自任一公司事实（对比场景两家数字均合法） */
export function assertNumbersTraceableAny(text: string, xrays: CompanyXRay[]): boolean {
  const legal = new Set<string>()
  for (const x of xrays) for (const n of collectFactNumbers(x)) legal.add(n)
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
    if (!legal.has(m[0])) return false
  }
  return true
}

/** 取某个维度的单维事实对象（维度深读/信号解释器用） */
export function dimensionFact(xray: CompanyXRay, k: NarrativeKey): LlmFact {
  const facts = buildFactPayload(xray)
  return facts[k]
}
