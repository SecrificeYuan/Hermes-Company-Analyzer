import type { CompanyXRay, NarrativeType } from '@/lib/types'

export type { NarrativeType }

export type NarrativeVia = 'contract' | 'trigger-pledge' | 'trigger-lawsuit' | 'healthy' | 'argmax'

export interface NarrativeResult {
  type: NarrativeType
  via: NarrativeVia
}

export const PLEDGE_TRIGGER = 60
export const LAWSUIT_TRIGGER = 5
const HEALTHY_MIN = 60
const ATK_HEALTHY_MAX = 40

const VALID_TYPES: readonly NarrativeType[] = ['debt', 'pledge', 'lawsuit', 'sentiment', 'balanced']

/**
 * 四维危险度（规格 §4.2 的 ATK 语义反转已内化）：
 * - hp/def 分数越高越安全 → 取 100 的补数；
 * - atk.score 即危险度，不取反；
 * - 舆情（morale）是噪声最大的信号，score 又是 avgTone 的线性映射——轻度负面
 *   （如 warning 的 avgTone≈-1）不足以主导版式。故按「负面 tone 强度」计危险度，
 *   只有明显负面舆情才触发 sentiment 版式。这与三家 mock 的锁定归属一致
 *   （warning → 资金告急），也是规格 §4.2 归属表的实现口径。
 */
function dimDangers(x: CompanyXRay): Record<Exclude<NarrativeType, 'balanced'>, number> {
  return {
    debt: 100 - x.hp.score,
    pledge: 100 - x.def.score,
    lawsuit: x.atk.score,
    sentiment: Math.max(0, -x.morale.avgTone * 10),
  }
}

/**
 * 风险叙事版式判定（规格 §4.2）。
 * ATK 语义反转：atk.score 越高 = 涉诉战火越旺（风险值），与 hp/def/morale 相反，
 * 统一换算为"危险度"后比较。
 */
export function narrativeOf(x: CompanyXRay): NarrativeResult {
  if (x.narrative && (VALID_TYPES as readonly string[]).includes(x.narrative)) {
    return { type: x.narrative, via: 'contract' }
  }
  const legalEvents = x.timeline.filter((e) => e.category === 'legal').length
  // 触发器优先：数据异常比分数更抓人；双命中时质押优先（平仓风险时间尺度更短）
  if (x.def.pledgeRatio >= PLEDGE_TRIGGER) return { type: 'pledge', via: 'trigger-pledge' }
  if (legalEvents >= LAWSUIT_TRIGGER) return { type: 'lawsuit', via: 'trigger-lawsuit' }
  // 健康线
  if (
    x.hp.score >= HEALTHY_MIN &&
    x.def.score >= HEALTHY_MIN &&
    x.morale.score >= HEALTHY_MIN &&
    x.atk.score <= ATK_HEALTHY_MAX
  ) {
    return { type: 'balanced', via: 'healthy' }
  }
  // 危险度 argmax；平局按声明顺序（质押 > 诉讼 > 资金 > 舆情，sort 稳定性保证）
  const d = dimDangers(x)
  const dangers: [NarrativeType, number][] = [
    ['pledge', d.pledge],
    ['lawsuit', d.lawsuit],
    ['debt', d.debt],
    ['sentiment', d.sentiment],
  ]
  dangers.sort((a, b) => b[1] - a[1])
  return { type: dangers[0][0], via: 'argmax' }
}

// ============================================================
// 编排传导（规格 §4.3）：单一 narrative 驱动速览层与详读层
// ============================================================

export type GlanceSlot = 'finance' | 'equity' | 'legal' | 'sentiment' | 'network'

const NARRATIVE_SLOT: Record<Exclude<NarrativeType, 'balanced'>, GlanceSlot> = {
  debt: 'finance',
  pledge: 'equity',
  lawsuit: 'legal',
  sentiment: 'sentiment',
}

export interface GlanceLayout {
  /** C 位：'radar' 表示均衡版式（雷达大图） */
  c: GlanceSlot | 'radar'
  /** 其余图位：四个维度按危险度降序，关联网络恒为末位 */
  rest: GlanceSlot[]
}

export function glanceLayout(x: CompanyXRay, narrative: NarrativeResult): GlanceLayout {
  const c = narrative.type === 'balanced' ? 'radar' : NARRATIVE_SLOT[narrative.type]
  const d = dimDangers(x)
  const danger: [GlanceSlot, number][] = [
    ['finance', d.debt],
    ['equity', d.pledge],
    ['legal', d.lawsuit],
    ['sentiment', d.sentiment],
  ]
  danger.sort((a, b) => b[1] - a[1])
  const rest = danger.map(([k]) => k).filter((k) => k !== c)
  rest.push('network')
  return { c, rest }
}

export type DetailSectionId = 'financial' | 'equity' | 'legal' | 'sentiment' | 'network' | 'evidence' | 'ai'

const SLOT_SECTION: Record<GlanceSlot, DetailSectionId> = {
  finance: 'financial',
  equity: 'equity',
  legal: 'legal',
  sentiment: 'sentiment',
  network: 'network',
}

/** 详读层 section 顺序（PRO 锚点同序）；evidence / ai 恒为末两位 */
export function detailOrder(layout: GlanceLayout): DetailSectionId[] {
  const core =
    layout.c === 'radar'
      ? layout.rest.map((s) => SLOT_SECTION[s])
      : [SLOT_SECTION[layout.c], ...layout.rest.map((s) => SLOT_SECTION[s])]
  return [...core, 'evidence', 'ai']
}
