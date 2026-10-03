import { formatWan } from '@/lib/utils'
import { pledgeAvailable } from '@/lib/evidence-availability'
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
 * 数字说明按已核实数据生成，避免 AI 自由文案覆盖数据状态或风险程度。
 * 模板禁止包含 LITE_BANNED_TERMS 中的专业术语（由测试反向锁定）。
 */
export function narrativeCopy(key: NarrativeKey, x: CompanyXRay): NarrativeCopy {
  const ai = x.llm?.sectionNotes?.[key]
  switch (key) {
    case 'hp': {
      if (x.hp.available === false) return {
        big: '暂无法判断', caption: '财务资料不足',
        text: '尚未取得足够的财务资料，不能判断日常经营是否带来现金，也不能把缺失数字当作零负债。',
      }
      const bleeding = x.hp.cashFlow < 0
      return {
        big: formatWan(x.hp.cashFlow),
        caption: '经营现金流',
        text: ai ?? (x.hp.cashFlow === 0
          ? '已披露年度的日常经营现金流入与流出相抵，不能仅凭这一数字判断账上现金是否够用。'
          : bleeding
            ? `已披露年度的日常经营现金流出比流入多 ${formatWan(-x.hp.cashFlow)}，需要进一步了解回款和支出的原因。`
            : `已披露年度的日常经营现金流入多于流出 ${formatWan(x.hp.cashFlow)}，欠下的债占资产的 ${x.hp.debtRatio}%；这不等于账上现金一定够用。`),
      }
    }
    case 'def': {
      if (!pledgeAvailable(x)) return {
        big: '暂无法判断', caption: '质押资料不足',
        text: '尚未取得可核实的股票质押资料，不能判断股东是否把股票押出去借钱；资料缺失不等于没有质押。',
      }
      const critical = x.def.pledgeRatio >= 60
      return {
        big: `${x.def.pledgeRatio}%`,
        caption: '股权质押比例',
        // def 不允许 AI 文案覆盖：质押比例是硬数据，AI 表述不得反转数据程度（credibility-copy 测试锁定）
        text: x.def.pledgeRatio === 0
          ? '已读取的质押资料显示比例为 0%，本次资料未显示股票质押；这不能说明公司的其他风险也为零。'
          : critical
            ? `已披露的股票质押比例为 ${x.def.pledgeRatio}%，比例较高。股价下跌时可能增加补充担保或卖出股票的压力，还需核实借款条件。`
            : x.def.pledgeRatio >= 40
              ? `已披露的股票质押比例为 ${x.def.pledgeRatio}%，需要关注变化和借款条件，不能仅凭比例判断会不会被强制卖出。`
              : `已披露的股票质押比例为 ${x.def.pledgeRatio}%，比例较低；这项资料不能单独证明公司经营稳定。`,
      }
    }
    case 'atk': {
      if (x.atk.available === false) {
        return {
          big: '暂无法判断',
          caption: '诉讼执行待核验',
          text: '当前无法核验诉讼、被执行与失信记录，不能据此推断公司不存在司法风险。',
        }
      }
      const count = x.atk.lawsuitCount
      const execution = x.atk.executionAmount
      const dishonest = x.detail?.dishonest ?? 0
      const lawsuits = x.detail?.lawsuits
      const plaintiffOnly = lawsuits?.length === count && count > 0 && lawsuits.every((item) => item.role === '原告')
      const text = count === 0
        ? '已读取的司法资料中未发现诉讼记录；这不保证所有时期和来源都没有案件。'
        : plaintiffOnly
          ? `已读取资料中有 ${count} 起官司，公司均为原告，可能是在维护自身权益；不能把起诉他人直接理解为经营受损。`
          : count < 5
            ? `已读取资料中有 ${count} 起官司，需要核对公司是原告还是被告、案件进展和金额；有官司不等于已经败诉。`
            : `已读取资料中有 ${count} 起官司，记录较多，需要重点核对案件角色、进展和金额；数量本身不能说明公司已经败诉。`
      return {
        big: `${count} 起`,
        caption: '已读取资料中的官司',
        text: ai ?? `${text}${execution > 0 ? `另有被执行记录，涉及 ${formatWan(execution)}，需要核对履行状态。` : ''}${dishonest > 0 ? `另有 ${dishonest} 条失信记录，需要核对当前状态。` : ''}`,
      }
    }
    case 'morale': {
      if (x.morale.available === false) return {
        big: '暂无法判断', caption: '舆情资料不足',
        text: '尚未取得可核实的新闻资料，不能判断报道倾向，也不能把缺失资料当作风评良好。',
      }
      const tone = x.morale.avgTone
      return {
        big: `${x.morale.avgTone}`,
        caption: '舆论温度（-10 ~ +10）',
        text: ai ?? (Math.abs(tone) < 0.5
          ? '已读取的新闻整体接近中性，没有明显偏向；新闻关键词不能代表所有人的评价。'
          : tone < 0
            ? `已读取的新闻${tone <= -3 ? '明显' : '略'}偏负面，需要查看原文确认原因；这不代表员工、客户或供应商都持负面看法。`
            : `已读取的新闻${tone >= 3 ? '明显' : '略'}偏正面；这不等于公司没有风险，也不能代表所有人的评价。`),
      }
    }
    case 'network': {
      const links = x.graph.links
      const related = new Set(x.graph.nodes.filter((node) => node.id !== 'company' && node.id !== x.id).map((node) => node.id)).size
      const risky = links.some((link) => link.risk)
      return {
        big: links.length ? `${related}` : '暂无法判断',
        caption: '已读取的关联节点',
        text: ai ?? (links.length === 0
          ? '尚无足够的关联关系资料，不能判断关联方是否存在风险，也不能把空白关系图当作安全证明。'
          : risky
            ? `已展示 ${related} 个关联节点，部分关系被规则标记为需要关注，可能涉及质押、持股集中或其他事件；标记本身不证明关联方被执行或失信。`
            : `已展示 ${related} 个关联节点，本次资料未触发关系风险标记；这不证明所有关联方都没有风险。`),
      }
    }
  }
}
