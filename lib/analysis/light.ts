// lib/analysis/light.ts
/**
 * 灯（LITE 首屏唯一结论）判定纯函数：基准档 = overallRisk 映射固定 headline；
 * fatal 命中直接红；非 fatal 1–2 条压黄、≥3 升一档（绿→黄、黄→红）；
 * 覆盖不足时绿色基准压黄并标 limitedSignals（"没查到"不得渲染成"干净"）。
 */
import type { HiddenStatus, LightVerdict, RiskLevel } from '@/lib/types'

export type Coverage = 'full' | 'partial' | 'insufficient'

const HEADLINE: Record<RiskLevel, string> = {
  green: '这钱能付',
  yellow: '能付，但换个付法',
  red: '先别付这钱',
}

function strongest(hiddenStatus: HiddenStatus[]): HiddenStatus | undefined {
  const rank = { high: 0, mid: 1, low: 2 } as const
  return [...hiddenStatus].sort((a, b) => {
    if (!!b.fatal !== !!a.fatal) return a.fatal ? -1 : 1
    return rank[a.severity] - rank[b.severity]
  })[0]
}

function buildReason(color: RiskLevel, hiddenStatus: HiddenStatus[], limited: boolean): string {
  if (limited) return '公开资料不全，这份评估只基于查得到的信号——没查到不等于没问题。'
  const top = strongest(hiddenStatus)
  if (color === 'green') return '查得到的信号里都干净：没官司缠身、没老板套现、没质押爆点。'
  if (!top) return '有几项信号需要留心，付之前建议点开证据看一眼。'
  return hiddenStatus.length > 1
    ? `查到了 ${hiddenStatus.length} 项危险信号，最扎眼的是「${top.label}」。`
    : `有一项信号值得留心：「${top.label}」。`
}

export function deriveLight(input: {
  overallRisk: RiskLevel
  hiddenStatus: HiddenStatus[]
  coverage: Coverage
}): LightVerdict {
  const { overallRisk, hiddenStatus, coverage } = input
  let color: RiskLevel = overallRisk
  const fatalHit = hiddenStatus.some((d) => d.fatal)
  const nonFatal = hiddenStatus.filter((d) => !d.fatal)
  if (fatalHit) color = 'red'
  else if (nonFatal.length >= 3 && color === 'green') color = 'yellow'
  else if (nonFatal.length >= 3 && color === 'yellow') color = 'red'
  else if (nonFatal.length >= 1 && color === 'green') color = 'yellow'
  const limited = coverage !== 'full' && color === 'green'
  if (limited) color = 'yellow'
  const saferAdvice = color === 'yellow'
    ? limited
      ? '先小额试一单，或选月付；大额付出去之前，把工商登记和经营备案再查一遍。'
      : '别一次付清——改月付或分期，把单笔损失锁到最小。'
    : undefined
  return {
    color,
    headline: HEADLINE[color],
    reason: buildReason(color, hiddenStatus, limited),
    saferAdvice,
    limitedSignals: limited || undefined,
  }
}
