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
}

export function getTerms(mode: Mode): Terms {
  return mode === 'pro' ? PRO : LITE
}
