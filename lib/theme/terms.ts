import type { Mode } from '@/lib/mode-store'

export interface Terms {
  healthLabel: string
  defLabel: string
  atkLabel: string
  moraleLabel: string
  hiddenTitle: string
  riskScoreCaption: string
  radarIndicators: [string, string, string, string, string]
  radarSeriesName: string
  cardTitles: {
    radar: string
    cashflow: string
    lawsuit: string
    sentiment: string
    timeline: string
    graph: string
  }
  sections: Record<'financial' | 'equity' | 'legal' | 'sentiment' | 'network' | 'evidence' | 'ai', string>
  metaStrip: { creditCode: string; foundedAt: string; registeredCapital: string; asOf: string; sources: string }
  narrativeTitles: Record<'debt' | 'pledge' | 'lawsuit' | 'sentiment' | 'balanced', string>
  dimensionTitles: Record<'hp' | 'def' | 'atk' | 'morale' | 'network', string>
  compare: CompareTerms
}

export interface CompareTerms {
  title: string
  action: string
  actionLoading: string
  winnerTemplate: string
  drawLabel: string
  idleHint: string
  slotLabel: string
  copyLink: string
  copied: string
  retry: string
  sameCompanyHint: string
  verdictQuoteTitle: string
  cardTitles: { table: string; trend: string; risk: string }
  llmTitle: string
  llmHint: string
}

const LITE: Terms = {
  healthLabel: '钱袋子',
  defLabel: '护盾 · 质押',
  atkLabel: '麻烦 · 官司',
  moraleLabel: '口碑',
  hiddenTitle: '隐藏状态',
  riskScoreCaption: '风险分',
  radarIndicators: ['血量', '护盾', '麻烦', '口碑', '稳健'],
  radarSeriesName: '五维体征',
  cardTitles: {
    radar: '五维体征',
    cashflow: '经营现金流趋势',
    lawsuit: '诉讼热力图',
    sentiment: '舆情情绪曲线',
    timeline: '风险时间轴 · 近 12 个月',
    graph: '关系图谱',
  },
  sections: {
    financial: '钱袋子',
    equity: '护盾',
    legal: '麻烦',
    sentiment: '口碑',
    network: '关系网',
    evidence: '证据与来源',
    ai: '智能解读',
  },
  metaStrip: { creditCode: '信用代码', foundedAt: '成立日期', registeredCapital: '注册资本', asOf: '分析基准时', sources: '数据来源' },
  narrativeTitles: { debt: '血量告急', pledge: '护盾告急', lawsuit: '麻烦缠身', sentiment: '人心浮动', balanced: '体征平稳' },
  dimensionTitles: { hp: '钱袋子', def: '护盾', atk: '麻烦', morale: '口碑', network: '关系网' },
  compare: {
    title: '两家公司比比看',
    action: '开始对比',
    actionLoading: '分析中…',
    winnerTemplate: '这钱付给 {name} 更稳',
    drawLabel: '两家差不多',
    idleHint: '选两家公司，看看钱付给谁更稳',
    slotLabel: '公司 {slot}',
    copyLink: '复制对比链接',
    copied: '已复制 ✓',
    retry: '重试',
    sameCompanyHint: '请选择两家不同的公司',
    verdictQuoteTitle: '两边各一句',
    cardTitles: { table: '关键指标对比', trend: '趋势对决', risk: '风险状态对决' },
    llmTitle: 'AI 深度对比',
    llmHint: '大模型多维归因 · 即将上线',
  },
}

const PRO: Terms = {
  healthLabel: '基本面健康度',
  defLabel: '偿债安全垫',
  atkLabel: '涉诉风险',
  moraleLabel: '舆情指数',
  hiddenTitle: '风险事件',
  riskScoreCaption: 'HEALTH SCORE',
  radarIndicators: ['健康度', '偿债安全', '涉诉风险', '舆情', '稳健'],
  radarSeriesName: '五维指标',
  cardTitles: {
    radar: '五维指标',
    cashflow: '经营现金流',
    lawsuit: '涉诉分布',
    sentiment: '舆情指数',
    timeline: '风险事件时间轴 · 近 12 个月',
    graph: '股权 / 关联网络',
  },
  sections: {
    financial: '财务详情',
    equity: '股权与质押',
    legal: '涉诉与执行',
    sentiment: '舆情洞察',
    network: '关联网络',
    evidence: '证据溯源',
    ai: 'AI 分析',
  },
  metaStrip: { creditCode: '统一社会信用代码', foundedAt: '成立日期', registeredCapital: '注册资本（万元）', asOf: '分析基准时', sources: '数据来源' },
  narrativeTitles: { debt: '资金承压', pledge: '质押风险突出', lawsuit: '涉诉风险突出', sentiment: '舆情承压', balanced: '经营稳健' },
  dimensionTitles: { hp: '财务健康', def: '股权质押', atk: '涉诉', morale: '舆情', network: '关联网络' },
  compare: {
    title: '双公司对比',
    action: '开始对比',
    actionLoading: '对比分析中…',
    winnerTemplate: '{name} 综合占优',
    drawLabel: '基本一致',
    idleHint: '选择两家公司开始对比',
    slotLabel: '公司 {slot}',
    copyLink: '复制对比链接',
    copied: '已复制 ✓',
    retry: '重试',
    sameCompanyHint: '请选择两家不同的公司',
    verdictQuoteTitle: '诊断引述',
    cardTitles: { table: '关键指标对比', trend: '趋势对比', risk: '风险事件对比' },
    llmTitle: 'AI 深度对比',
    llmHint: '大模型多维归因分析 · 即将上线',
  },
}

export function getTerms(mode: Mode): Terms {
  return mode === 'pro' ? PRO : LITE
}

/** LITE 界面禁用词表（专业金融术语）：LITE 渲染文案不得包含（规格 §10 反向校验） */
export const LITE_BANNED_TERMS = [
  '资产负债率', '流动比率', '净利润', '营业收入', '同比', '环比', 'ROE', 'PE', 'PB', '贴现', '流动性危机',
] as const
