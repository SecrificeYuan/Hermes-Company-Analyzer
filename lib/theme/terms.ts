import type { Mode } from '@/lib/mode-store'

export interface Terms {
  radarIndicators: [string, string, string, string, string]
  radarSeriesName: string
}

const LITE: Terms = {
  radarIndicators: ['HP 血量', 'DEF 护甲', 'ATK 涉诉', '士气', '稳健'],
  radarSeriesName: '五维属性',
}

const PRO: Terms = {
  radarIndicators: ['健康度', '偿债安全', '涉诉风险', '舆情', '稳健'],
  radarSeriesName: '五维指标',
}

export function getTerms(mode: Mode): Terms {
  return mode === 'pro' ? PRO : LITE
}
