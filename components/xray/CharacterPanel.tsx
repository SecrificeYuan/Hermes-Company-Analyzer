'use client'

import { HealthBar } from './HealthBar'
import { StatNumber } from './StatNumber'
import { DataSourceBadge } from './DataSourceBadge'
import { AttributeRadar } from './AttributeRadar'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'
import type { CompanyHealth } from '@/lib/company'
import { listingLabels } from '@/lib/company'

function DimRow({ label, score, sub, unavailable = false }: { label: string; score: number; sub: string; unavailable?: boolean }) {
  const t = useTokens()
  const color = scoreColor(t, score)
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
        <span className="tracking-wider text-slate-400">{label}</span>
        <span style={{ color }}>{sub}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-ink-bg/80">
        {unavailable ? <div className="h-full border border-dashed border-edge" /> : (
          <div className="h-full rounded" style={{ background: color, boxShadow: `0 0 8px ${color}66`, width: `${score}%` }} />
        )}
      </div>
    </div>
  )
}

function MissingBlock({ label }: { label: string }) {
  return (
    <div className="rounded-btn border border-dashed border-edge px-3 py-2 text-xs text-slate-500">
      {label}这块没查到——没查到不等于没问题
    </div>
  )
}

/** LITE 面板层：身份+血条+维度条+小雷达+数据源；灯与 debuff 由 XrayClient 直出 */
export function CharacterPanel({ xray, health }: { xray: CompanyXRay; health?: CompanyHealth }) {
  const terms = getTerms('lite')
  return (
    <div className="glass-card p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card border border-neon/30 bg-neon/5 text-2xl font-bold text-neon shadow-glow">
          {xray.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-slate-50">{xray.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {health ? listingLabels[health.company.listing] : xray.stockCode ?? 'UNLISTED'} · {xray.industry}
          </div>
          {!health && (
            <div className="mt-1.5 flex items-baseline gap-1">
              <StatNumber value={xray.riskScore} className="text-base font-bold text-slate-100" duration={1.2} />
              <span className="font-mono text-[9px] tracking-[0.2em] text-slate-500">{terms.riskScoreCaption}</span>
            </div>
          )}
        </div>
      </div>

      {!health && (
        <div className="mt-5 space-y-5">
          <HealthBar hp={xray.hp} />
          <div className="space-y-3">
            <DimRow label={terms.defLabel} score={xray.def.score} sub={`${xray.def.label} · 质押 ${xray.def.pledgeRatio}%`} />
            <DimRow label={terms.atkLabel} score={xray.atk.score} sub={xray.atk.available === false ? '司法数据暂未接入' : `${xray.atk.label} · 官司 ${xray.atk.lawsuitCount} 起 / 被执行 ${formatWan(xray.atk.executionAmount)}`} unavailable={xray.atk.available === false} />
            <DimRow label={terms.moraleLabel} score={xray.morale.score} sub={xray.morale.available === false ? '新闻加载中' : `${xray.morale.label} · 口碑 ${xray.morale.avgTone}`} unavailable={xray.morale.available === false} />
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] tracking-[0.25em] text-slate-500">{terms.cardTitles.radar}</div>
            <AttributeRadar xray={xray} height={140} />
          </div>
        </div>
      )}

      {health && (
        <div className="mt-5 space-y-3">
          {health.years.length || health.metrics.operatingCashFlow !== null ? <HealthBar hp={xray.hp} /> : <MissingBlock label="财务" />}
          {health.metrics.pledgeRatio !== null ? <DimRow label={terms.defLabel} score={xray.def.score} sub={`质押 ${health.metrics.pledgeRatio}%`} /> : <MissingBlock label="质押" />}
          {health.metrics.lawsuitAnnouncements !== null ? <DimRow label={terms.atkLabel} score={xray.atk.score} sub={`官司 ${health.metrics.lawsuitAnnouncements} 起（公告线索）`} /> : <MissingBlock label="司法" />}
          <MissingBlock label="口碑" />
          {health.gaps.length > 0 && (
            <p className="text-xs text-warn">还缺：{health.gaps.join('；')}</p>
          )}
        </div>
      )}

      <div className="mt-5">
        <DataSourceBadge sources={xray.sources} />
      </div>
    </div>
  )
}
