'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, GitCompareArrows } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AttributeRadar } from './AttributeRadar'
import { CashFlowChart } from './CashFlowChart'
import { CharacterPanel } from './CharacterPanel'
import { EvidenceDrawer } from './EvidenceDrawer'
import { HiddenStatusList } from './HiddenStatusList'
import { LawsuitHeatmap } from './LawsuitHeatmap'
import { LightBanner } from './LightBanner'
import { NarrativeCard } from './NarrativeCard'
import { RelationGraph } from './RelationGraph'
import { SentimentCurve } from './SentimentCurve'
import { AnchorNav } from './AnchorNav'
import { MetaStrip } from './MetaStrip'
import { NextStepsCard } from './NextStepsCard'
import { MarketZone } from './market/MarketZone'
import { SectionShell } from './detail/SectionShell'
import { FinancialSection } from './detail/FinancialSection'
import { EquitySection, PledgeSummary } from './detail/EquitySection'
import { LegalSection } from './detail/LegalSection'
import { SentimentSection } from './detail/SentimentSection'
import { NetworkSection } from './detail/NetworkSection'
import { EvidenceSection } from './detail/EvidenceSection'
import { ShareCard } from '@/components/share/ShareCard'
import { AiGlanceCard } from './AiGlanceCard'
import { AiInsightCard } from './AiInsightCard'
import { useSentiment } from './useSentiment'
import { detailOrder, glanceLayout, narrativeOf } from '@/lib/narrative'
import type { DetailSectionId, GlanceSlot } from '@/lib/narrative'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'
import type { CompanyHealth } from '@/lib/company'

/** 统一出场缓动：ease-out 长尾，避免线性/突变感 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/** 首屏（挂载即播） */
const rise = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.06, duration: 0.55, ease: EASE } }),
}

/** 滚动进入视口时播放（只播一次，提前 80px 触发） */
const riseInView = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.55, ease: EASE } }),
}
const viewport = { once: true, margin: '-80px' } as const

/** LITE 详读层只渲染五个维度卡（证据入口在每张卡上；ai 为 PRO 专属 section） */
const LITE_SECTION_KEY: Partial<Record<DetailSectionId, NarrativeKey>> = {
  financial: 'hp', equity: 'def', legal: 'atk', sentiment: 'morale', network: 'network',
}

/** 速览层图位 → 卡片标题（双模式术语） */
function slotTitle(slot: GlanceSlot, terms: ReturnType<typeof getTerms>): string {
  switch (slot) {
    case 'finance': return terms.cardTitles.cashflow
    case 'equity': return terms.dimensionTitles.def
    case 'legal': return terms.cardTitles.lawsuit
    case 'sentiment': return terms.cardTitles.sentiment
    case 'network': return terms.cardTitles.graph
  }
}

/** 报告页客户端容器：头（版式无关）→ 速览层（版式驱动）→ 详读层（双密度，规格 §3） */
export function XrayClient({ xray, health }: { xray: CompanyXRay; health?: CompanyHealth }) {
  const mode = useMode()
  const terms = getTerms(mode)
  const { snapshot: sentiment, loading: sentimentLoading, slow: sentimentSlow } = useSentiment(xray.id)
  // AI 点评卡生成完 summary 后回填速览层（AiGlanceCard 替换"待生成"占位）
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  // 只在舆情请求成功后覆盖该切片；综合风险与其余已完成模块保持首次结果，
  // 避免慢源返回时造成报告版式和主结论跳变。
  const displayXray: CompanyXRay = sentiment?.status === 'available' && sentiment.morale
    ? {
      ...xray,
      morale: sentiment.morale,
      detail: xray.detail && { ...xray.detail, sentimentItems: sentiment.items },
    }
    : xray
  const narrative = narrativeOf(xray)
  const layout = health
    ? { c: 'radar' as const, rest: ['finance', 'equity', 'legal', 'sentiment', 'network'] as GlanceSlot[] }
    : glanceLayout(xray, narrative)
  const order = detailOrder(layout)

  const proCharts: Record<GlanceSlot, ReactNode> = {
    finance: health && !health.years.length ? <MissingMetric label="完整年度财报" /> : <CashFlowChart hp={displayXray.hp} height={280} />,
    equity: health && health.metrics.pledgeRatio === null ? <MissingMetric label="股权质押" /> : <PledgeSummary xray={displayXray} />,
    legal: health && health.metrics.lawsuitAnnouncements === null ? <MissingMetric label="司法记录" /> : <LawsuitHeatmap timeline={displayXray.timeline} available={displayXray.atk.available !== false} height={280} />,
    sentiment: health ? <MissingMetric label="可核实的舆情记录" /> : <SentimentCurve morale={displayXray.morale} height={280} loading={sentimentLoading} slow={sentimentSlow} message={sentiment?.message} />,
    network: health ? <MissingMetric label="关联网络" /> : <RelationGraph graph={displayXray.graph} centerLabel={displayXray.name} height={280} />,
  }

  return (
    <main className={`mx-auto max-w-7xl px-6 py-8 ${mode === 'lite' ? 'flex h-[calc(100vh-2.25rem)] flex-col overflow-hidden' : 'min-h-screen'}`}>
      {/* LITE：顶栏 → 灯区 → 两列内滚（左面板 / 右 debuff+叙事卡） */}
      {mode === 'lite' && (
        <>
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link href="/"><ArrowLeft /> 重新扫描</Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href={xray.stockCode ? `/compare?a=${xray.stockCode}` : '/compare'}><GitCompareArrows /> 双公司对比</Link>
              </Button>
              {!health && <ShareCard xray={xray} />}
            </div>
          </div>
          <motion.div variants={rise} custom={0} initial="hidden" animate="show">
            <LightBanner xray={displayXray} />
          </motion.div>
          {/* 单行高度钳进剩余空间（minmax(0,1fr)），两列 stretch 后各自内滚；auto 行会被内容撑破一屏约束 */}
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,350px)]">
            <motion.div variants={rise} custom={1} initial="hidden" animate="show" className="min-h-0 min-w-0 lg:overflow-y-auto">
              <CharacterPanel xray={displayXray} health={health} />
              <motion.div variants={riseInView} custom={2} initial="hidden" whileInView="show" viewport={viewport} className="mt-6">
                <AiInsightCard reportId={xray.id} companyName={displayXray.name} nextSteps={displayXray.nextSteps} />
              </motion.div>
            </motion.div>
            <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1">
              {displayXray.hiddenStatus.length >= 3 && (
                <div className="rounded-btn border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger">
                  ⚠ 多重负面状态叠加，情况危险
                </div>
              )}
              <div>
                <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
                  {terms.hiddenTitle}
                  <span className="text-grape">×{displayXray.hiddenStatus.length}</span>
                </div>
                <div className="max-h-72 overflow-y-auto pr-1">
                  <HiddenStatusList items={displayXray.hiddenStatus} />
                </div>
              </div>
              {order.map((id, i) => {
                const k = LITE_SECTION_KEY[id]
                return k ? (
                  <motion.div key={id} variants={rise} custom={2 + i} initial="hidden" animate="show">
                    <NarrativeCard id={`detail-${id}`} k={k} xray={displayXray} compact />
                  </motion.div>
                ) : null
              })}
            </div>
          </div>
        </>
      )}

      {/* 头：PRO 元信息条；LITE 角色横幅 + 右侧五维紧凑卡竖列 */}
      {mode === 'pro' && (
        <motion.div variants={rise} custom={0} initial="hidden" animate="show">
          <MetaStrip xray={displayXray} health={health} />
        </motion.div>
      )}

      {/* 下一步行动建议（LLM 成功时存在；失败整块隐藏，不显示占位） */}
      {mode === 'pro' && displayXray.nextSteps && (
        <motion.div variants={riseInView} custom={1} initial="hidden" whileInView="show" viewport={viewport} className="mt-6">
          <NextStepsCard nextSteps={displayXray.nextSteps} />
        </motion.div>
      )}

      {/* 行情与资金区（PRO 专属；资料缺口主体不展示行情） */}
      {mode === 'pro' && !health && (
        <motion.div variants={riseInView} custom={0} initial="hidden" whileInView="show" viewport={viewport} className="mt-6">
          <MarketZone
            xray={displayXray}
            sentimentLoading={sentimentLoading}
            sentimentSlow={sentimentSlow}
            sentimentMessage={sentiment?.message}
          />
        </motion.div>
      )}

      {/* 速览层（规格 §3.3）：仅 PRO；LITE 的信息已并入上方横幅与下方维度网格 */}
      {mode === 'pro' && (
      <div className="mt-6">
        {(
          <div className="grid gap-6 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
            {/* C 位：2×2 放大 */}
            <motion.div variants={riseInView} custom={0} initial="hidden" whileInView="show" viewport={viewport} className="min-w-0 lg:col-span-2 lg:row-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    {layout.c === 'radar' ? terms.cardTitles.radar : slotTitle(layout.c, terms)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {layout.c === 'radar'
                    ? health ? <MissingEvidencePanel health={health} /> : <AttributeRadar xray={displayXray} height={560} />
                    : proCharts[layout.c]}
                </CardContent>
              </Card>
            </motion.div>
            {layout.rest.map((slot, i) => (
              <motion.div key={slot} variants={riseInView} custom={1 + i} initial="hidden" whileInView="show" viewport={viewport}>
                <Card className="h-full">
                  <CardHeader><CardTitle>{slotTitle(slot, terms)}</CardTitle></CardHeader>
                  <CardContent>{proCharts[slot]}</CardContent>
                </Card>
              </motion.div>
            ))}
            {/* 右下角补位：AI 速览入口（方案 C） */}
            <motion.div variants={riseInView} custom={1 + layout.rest.length} initial="hidden" whileInView="show" viewport={viewport} className="h-full">
              {health
                ? <Card className="h-full"><CardHeader><CardTitle>AI 速览</CardTitle></CardHeader><CardContent><MissingMetric label="AI 分析所需证据" /></CardContent></Card>
                : <AiGlanceCard xray={displayXray} liveSummary={aiSummary} />}
            </motion.div>
          </div>
        )}
      </div>
      )}

      {/* 维度层（规格 §3.4）：仅 PRO；LITE 的维度卡已并入上方横幅右侧竖列 */}
      {mode === 'pro' && (
      <div className="mt-10">
        <h2 className="mb-4 font-mono text-xs tracking-[0.3em] text-slate-500">DETAIL REPORT</h2>

        <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
          <AnchorNav items={order.map((id) => ({ id, label: terms.sections[id] }))} />
          <div className="min-w-0 space-y-6">
            {order.map((id, i) => (
            <motion.div key={id} variants={riseInView} custom={i} initial="hidden" whileInView="show" viewport={viewport}>
              <SectionShell id={id} index={i + 1} title={terms.sections[id]}>
                <SectionBody id={id} xray={displayXray} health={health} sentiment={sentiment} sentimentLoading={sentimentLoading} sentimentSlow={sentimentSlow} onAiSummary={setAiSummary} />
              </SectionShell>
            </motion.div>
            ))}
          </div>
        </div>
      </div>
      )}

      <footer className={`mt-10 text-center font-mono text-[11px] text-slate-600 ${mode === 'lite' ? 'shrink-0' : ''}`}>
        HERMES · 所有结论均可点开证据溯源 · 数据仅供演示，不构成投资建议
      </footer>

      <EvidenceDrawer />
    </main>
  )
}

/** PRO section 内容（顺序由 detailOrder 版式传导） */
function SectionBody({
  id,
  xray,
  health,
  sentiment,
  sentimentLoading,
  sentimentSlow,
  onAiSummary,
}: {
  id: DetailSectionId
  xray: CompanyXRay
  health?: CompanyHealth
  sentiment?: import('@/lib/types').SentimentSnapshot
  sentimentLoading: boolean
  sentimentSlow: boolean
  onAiSummary?: (summary: string) => void
}) {
  if (health && id === 'evidence') return <MissingEvidencePanel health={health} />
  if (health && id === 'financial') return health.years.length ? <FinancialSection xray={xray} health={health} /> : <MissingMetric label="该企业的完整年度财务报表" />
  if (health && id === 'equity') return <MissingMetric label="该企业的完整股权结构与控制关系" />
  if (health && id === 'legal') return <MissingMetric label="该企业的完整司法与执行记录" />
  if (health && id === 'sentiment') return <MissingMetric label="可核实的舆情记录" />
  if (health && id === 'network') return <MissingMetric label="关联实体与控制关系" />
  if (health && id === 'ai') return <MissingMetric label="足够支撑 AI 分析的证据" />
  switch (id) {
    case 'financial': return <FinancialSection xray={xray} />
    case 'equity': return <EquitySection xray={xray} />
    case 'legal': return <LegalSection xray={xray} />
    case 'sentiment': return <SentimentSection xray={xray} snapshot={sentiment} loading={sentimentLoading} slow={sentimentSlow} />
    case 'network': return <NetworkSection xray={xray} />
    case 'evidence': return <EvidenceSection xray={xray} />
    case 'ai': return <AiInsightCard reportId={xray.id} companyName={xray.name} onSummary={onAiSummary} />
  }
}

function MissingMetric({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{label}待核实；缺失数据不按零风险处理。</p>
}

function MissingEvidencePanel({ health }: { health: CompanyHealth }) {
  return <div className="space-y-4 text-sm text-slate-300">
    <p>当前可核实的资料不足以给出完整健康评分或投资回报率。{health.company.identity === 'lead' ? '企业法律主体仍待工商登记核对。' : ''}</p>
    <dl className="grid gap-3 sm:grid-cols-2">
      {([['统一社会信用代码线索', health.company.creditCode], ['注册地区', health.company.region], ['行业', health.company.industry], ['成立日期', health.company.foundedAt], ['公司简介', health.company.description]] as const).map(([label, value]) => <div key={label} className="border-b border-edge pb-2"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words">{value || '待核实'}</dd></div>)}
    </dl>
    <p className="text-xs text-warn">待补充：{health.gaps.join('；')}</p>
    {health.sources.map((source, index) => <p key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-neon hover:underline">{source.title}</a> · {source.state === 'ok' ? '已读取' : source.state === 'empty' ? '无匹配' : '访问受限或暂不可用'}<span className="block text-xs text-slate-500">{source.note}</span></p>)}
  </div>
}
