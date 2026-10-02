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
  healthLabel: 'HP · 财务血量',
  defLabel: 'DEF · 护甲',
  atkLabel: 'ATK · 涉诉攻击',
  moraleLabel: '士气 · 舆情',
  hiddenTitle: 'HIDDEN STATUS',
  riskScoreCaption: 'RISK SCORE',
  radarIndicators: ['HP 血量', 'DEF 护甲', 'ATK 涉诉', '士气', '稳健'],
  radarSeriesName: '五维属性',
  cardTitles: {
    radar: '五维属性雷达',
    cashflow: '经营现金流趋势',
    lawsuit: '诉讼热力图',
    sentiment: '舆情情绪曲线',
    timeline: '风险时间轴 · 近 12 个月',
    graph: '关系图谱',
  },
  compare: {
    title: '双公司对战',
    action: '开战',
    actionLoading: '分析中…',
    winnerTemplate: '{name} 胜 · 更健康',
    drawLabel: '势均力敌',
    idleHint: '选两家公司，看看谁更健康',
    slotLabel: 'PLAYER {slot}',
    copyLink: '复制对比链接',
    copied: '已复制 ✓',
    retry: '重试',
    sameCompanyHint: '请选择两家不同的公司',
    verdictQuoteTitle: '双方诊断',
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
