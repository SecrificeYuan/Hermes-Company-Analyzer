'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Bot, Check, Copy, GitCompareArrows,
  ShieldAlert, ShieldCheck, TrendingDown, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataSourceBadge } from './DataSourceBadge'
import { ShareCard } from '@/components/share/ShareCard'
import { StatNumber } from './StatNumber'
import { formatWan } from '@/lib/utils'
import { useTencentQuote } from '@/lib/hooks/use-tencent-quote'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'
import type { CompanyHealth } from '@/lib/company'
import { riskAvailable } from '@/lib/evidence-availability'

const RISK_META = {
  green: { label: '低风险', en: 'CLEAN', Icon: ShieldCheck },
  yellow: { label: '中风险', en: 'SUSPECT', Icon: AlertTriangle },
  red: { label: '高风险', en: 'MALICIOUS', Icon: ShieldAlert },
}

/** 圆角六边形 SVG 路径（尖顶，cx/cy 为中心，R 外接圆半径，r 圆角半径） */
function roundedHexPath(cx: number, cy: number, R: number, r: number): string {
  const pts: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)])
  }
  const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])
  let d = ''
  for (let i = 0; i < 6; i++) {
    const prev = pts[(i + 5) % 6]
    const cur = pts[i]
    const next = pts[(i + 1) % 6]
    const p1: [number, number] = [cur[0] + ((prev[0] - cur[0]) * r) / dist(cur, prev), cur[1] + ((prev[1] - cur[1]) * r) / dist(cur, prev)]
    const p2: [number, number] = [cur[0] + ((next[0] - cur[0]) * r) / dist(cur, next), cur[1] + ((next[1] - cur[1]) * r) / dist(cur, next)]
    d += `${i === 0 ? 'M' : 'L'} ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} Q ${cur[0].toFixed(2)} ${cur[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} `
  }
  return d + 'Z'
}

/** 印章尺寸（px）：外接圆半径外环 74 / 绿描边 64 / 暗底 59（绿环 5px），圆角 10 */
const SEAL = { view: 148, center: 74, ring: 74, green: 64, inner: 59, corner: 10 }
const SEAL_DARK = '#0c1220'

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      aria-label="复制"
      className="text-slate-600 transition-colors hover:text-neon"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text) } catch { /* 剪贴板不可用时静默 */ }
        setOk(true)
        setTimeout(() => setOk(false), 1200)
      }}
    >
      {ok ? <Check className="h-3 w-3 text-safe" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

/**
 * PRO 概要头（威胁情报式，对照微步沙箱报告）：
 * 左侧白底双层六边形"印章"（风险色描边 + 微阴影悬浮）+ 主数据区（标题 / 时间行 /
 * 两列元信息 / HASH 块 / 结论）+ 右列评分 + 底部横排操作按钮。无多余边框分隔线。
 */
export function MetaStrip({ xray, health }: { xray: CompanyXRay; health?: CompanyHealth }) {
  const assessed = !health && riskAvailable(xray)
  const meta = assessed ? RISK_META[xray.overallRisk] : { label: '资料不足', en: 'UNKNOWN', Icon: AlertTriangle }
  const t = useTokens()
  const terms = getTerms('pro')
  const color = assessed ? t.riskColor[xray.overallRisk] : t.colors.textDim
  const r = xray.registry
  const quote = useTencentQuote(health ? undefined : xray.stockCode)
  const quoteColor = quote && quote.change > 0 ? t.colors.danger : quote && quote.change < 0 ? t.colors.safe : t.colors.textDim

  /** 左侧标签等宽加粗，值直接展示——微步"文件大小 / 文件类型"式 */
  const kv: { k: string; v: React.ReactNode }[] = [
    ...(r ? [] : health?.company.creditCode ? [{ k: '信用代码线索', v: health.company.creditCode }] : []),
    { k: '所属行业', v: xray.industry },
    ...(r ? [{ k: terms.metaStrip.foundedAt, v: r.foundedAt }] : []),
    ...(r ? [{ k: terms.metaStrip.registeredCapital, v: formatWan(r.registeredCapital) }] : []),
    { k: '风险评分', v: assessed ? (
      <>
        <span className="font-semibold" style={{ color }}>{xray.riskScore}</span>
        <span className="text-slate-600"> / 100</span>
      </>
    ) : '暂无法判断' },
  ]

  return (
    <header
      className="glass-card overflow-hidden p-0"
      style={{ borderColor: `${color}33` }}
    >
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* 左侧印章：暗底六边形 + 外发光，标签在正下方（中心无亮斑） */}
          <div className="flex shrink-0 items-center gap-4 lg:w-48 lg:flex-col lg:justify-center">
            <div
              className="relative h-[148px] w-[148px]"
              style={{
                filter: `drop-shadow(0 0 10px ${color}66) drop-shadow(0 0 28px ${color}30)`,
              }}
            >
              <svg
                width={SEAL.view}
                height={SEAL.view}
                viewBox={`0 0 ${SEAL.view} ${SEAL.view}`}
                className="absolute inset-0"
                aria-hidden="true"
              >
                <path d={roundedHexPath(SEAL.center, SEAL.center, SEAL.ring, SEAL.corner)} fill={SEAL_DARK} />
                <path d={roundedHexPath(SEAL.center, SEAL.center, SEAL.green, SEAL.corner)} fill={color} />
                <path d={roundedHexPath(SEAL.center, SEAL.center, SEAL.inner, SEAL.corner)} fill={SEAL_DARK} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <meta.Icon className="h-11 w-11" style={{ color }} strokeWidth={2} />
              </div>
            </div>
            <div className="lg:mt-1 lg:text-center">
              <div className="text-xl font-bold tracking-wide" style={{ color }}>{meta.label}</div>
              <div className="mt-0.5 font-mono text-[10px] tracking-[0.3em] text-slate-600">{meta.en}</div>
            </div>
          </div>

          {/* 主数据区 */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[28px] font-bold leading-tight text-slate-50">{r?.fullName ?? xray.name}</h1>
              <CopyBtn text={r?.fullName ?? xray.name} />
              <span className="font-mono text-xs text-slate-500">
                {xray.stockCode ?? 'UNLISTED'} · {xray.industry}
              </span>
              {/* 健康度小环（原右栏融入标题行） */}
              {!health && xray.hp.available !== false && <span className="ml-1 inline-flex items-center gap-1.5 self-center" title={terms.healthLabel}>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(${color} 0 ${xray.hp.score * 3.6}deg, ${t.colors.edge} ${xray.hp.score * 3.6}deg 360deg)` }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-card font-mono text-[11px] font-semibold text-slate-50">
                    <StatNumber value={xray.hp.score} duration={1.2} />
                  </span>
                </span>
                <span className="font-mono text-[10px] tracking-wider text-slate-600">{terms.healthLabel}</span>
              </span>}
            </div>

            {/* 时间行（微步"首次提交 / 末次提交 / 末次分析"式） */}
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-slate-500">数据截至</span>
                <span className="font-mono text-xs text-slate-300">{xray.asOf.replace('T', ' ').slice(0, 16)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-slate-500">报告生成</span>
                <span className="font-mono text-xs text-slate-300">{xray.generatedAt.replace('T', ' ').slice(0, 16)}</span>
              </div>
              {quote && (
                <span className="inline-flex items-center gap-2 rounded-md bg-ink-card/70 px-2.5 py-1 font-mono text-xs">
                  <span className="text-sm font-semibold" style={{ color: quoteColor }}>{quote.price.toFixed(2)}</span>
                  <span className="inline-flex items-center gap-0.5" style={{ color: quoteColor }}>
                    {quote.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
                  </span>
                  <span className="text-slate-500">高 {quote.high.toFixed(2)} / 低 {quote.low.toFixed(2)}</span>
                  {quote.totalCapYi !== null && <span className="text-slate-500">市值 {quote.totalCapYi.toFixed(0)}亿</span>}
                </span>
              )}
            </div>

            {/* 两列元信息：左侧标签等宽加粗，无下划线无边框 */}
            <dl className="mt-5 grid grid-cols-1 gap-x-12 gap-y-2.5 sm:grid-cols-2">
              {kv.map((item) => (
                <div key={item.k} className="flex items-baseline gap-3">
                  <dt className="w-24 shrink-0 font-mono text-xs font-medium text-slate-500">{item.k}</dt>
                  <dd className="min-w-0 truncate font-mono text-xs text-slate-300">{item.v}</dd>
                </div>
              ))}
              {r && (
                <div className="flex items-baseline gap-3">
                  <dt className="w-24 shrink-0 font-mono text-xs font-medium text-slate-500">{terms.metaStrip.creditCode}</dt>
                  <dd className="min-w-0 truncate font-mono text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5">{r.creditCode}<CopyBtn text={r.creditCode} /></span>
                  </dd>
                </div>
              )}
            </dl>

            {/* HASH 块（微步式：小标题 + 键值行，无边框，弱底色） */}
            <div className="mt-5 rounded-lg bg-ink-card/40 px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.3em] text-slate-600">HASH</div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-baseline gap-3">
                  <span className="w-16 shrink-0 font-mono text-[11px] text-slate-500">CODE</span>
                  <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-slate-300">
                    {xray.stockCode ?? 'UNLISTED'}
                    {xray.stockCode && <CopyBtn text={xray.stockCode} />}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="w-16 shrink-0 font-mono text-[11px] text-slate-500">AS-OF</span>
                  <span className="font-mono text-xs text-slate-300">{xray.asOf.slice(0, 10)}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="w-16 shrink-0 font-mono text-[11px] text-slate-500">RISK</span>
                  <span className="font-mono text-xs" style={{ color }}>{meta.en} · {meta.label}</span>
                </div>
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">{xray.verdict}</p>
            <p className="mt-1.5 text-xs text-slate-400">
              <span className="font-mono text-[10px] tracking-wider text-slate-600">ADVICE </span>
              {xray.advice}
            </p>
            <div className="mt-3">
              <DataSourceBadge sources={xray.sources ?? []} />
            </div>
          </div>
        </div>
      </div>

      {/* 底部横排操作按钮（微步式，无边框分隔线） */}
      <div className="flex flex-wrap items-center gap-2 px-6 pb-6 md:px-8 md:pb-8">
        <Button asChild size="sm" variant="default">
          <Link href="/"><ArrowLeft className="h-3.5 w-3.5" /> 重新扫描</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={xray.stockCode ? `/compare?a=${xray.stockCode}` : '/compare'}><GitCompareArrows className="h-3.5 w-3.5" /> 双公司对比</Link>
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => document.getElementById('ai')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <Bot className="h-3.5 w-3.5" /> AI 解读
        </Button>
        <ShareCard xray={xray} />
      </div>
    </header>
  )
}
