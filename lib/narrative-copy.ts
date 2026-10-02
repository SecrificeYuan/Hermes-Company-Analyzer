import { formatWan } from '@/lib/utils'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

export type { NarrativeKey }

export const NARRATIVE_ICONS: Record<NarrativeKey, string> = {
  hp: '💰', def: '🛡️', atk: '⚔️', morale: '📣', network: '🕸️',
}

export interface NarrativeCopy {
  big: string
  caption: string
  text: string
}

/**
 * LITE 叙事卡文案（规格 §5.1 NarrativeCard）。
 * llm.sectionNotes 存在时优先（AI 解读），否则回落人话模板。
 * 模板禁止包含 LITE_BANNED_TERMS 中的专业术语（由测试反向锁定）。
 */
export function narrativeCopy(key: NarrativeKey, x: CompanyXRay): NarrativeCopy {
  const ai = x.llm?.sectionNotes?.[key]
  switch (key) {
    case 'hp': {
      const bleeding = x.hp.cashFlow < 0
      return {
        big: formatWan(x.hp.cashFlow),
        caption: '经营现金流',
        text: ai ?? (bleeding
          ? `一年下来钱包里流出的比流入的多 ${formatWan(-x.hp.cashFlow)}，还在持续失血。`
          : `账上现金能覆盖日常运转，但欠下的债是资产的 ${x.hp.debtRatio}%。`),
      }
    }
    case 'def': {
      const critical = x.def.pledgeRatio >= 60
      return {
        big: `${x.def.pledgeRatio}%`,
        caption: '股权质押比例',
        text: ai ?? (critical
          ? `大股东把手里 ${x.def.pledgeRatio}% 的股票都押出去借钱了。股价再大跌，这些股票会被强制卖掉，公司可能突然换主人。`
          : `大股东押出去的股票不到一半，暂时还稳得住。`),
      }
    }
    case 'atk': {
      if (x.atk.available === false) {
        return {
          big: '暂无法判断',
          caption: '司法数据暂未接入',
          text: '当前无法核验诉讼、被执行与失信记录，不能据此推断公司不存在司法风险。',
        }
      }
      const exec = x.atk.executionAmount > 0 ? `，被执行的钱有 ${formatWan(x.atk.executionAmount)}` : ''
      return {
        big: `${x.atk.lawsuitCount} 起`,
        caption: '近一年官司',
        text: ai ?? `最近一年身上挂着 ${x.atk.lawsuitCount} 起官司${exec}，钱包和名声都在流血。`,
      }
    }
    case 'morale': {
      const negative = x.morale.avgTone < 0
      return {
        big: `${x.morale.avgTone}`,
        caption: '舆论温度（-10 ~ +10）',
        text: ai ?? (negative
          ? `网上骂声一片，舆论温度跌到 ${x.morale.avgTone}。员工、供应商和客户都在观望。`
          : `网上风评不错，舆论温度 ${x.morale.avgTone}。`),
      }
    }
    case 'network': {
      const risky = x.graph.links.some((l) => l.risk)
      return {
        big: `${x.graph.nodes.length}`,
        caption: '关联公司 / 人物',
        text: ai ?? `和 ${x.graph.nodes.length} 家公司或人物有股权、生意往来，关系网里${risky ? '有人已经被执行或失信' : '暂时没有爆雷的关联方'}。`,
      }
    }
  }
}
