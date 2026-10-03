'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, GitCompareArrows } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AttributeRadar } from './AttributeRadar'
import { CashFlowChart } from './CashFlowChart'
import { CharacterCard } from './CharacterCard'
import { EvidenceDrawer } from './EvidenceDrawer'
import { LawsuitHeatmap } from './LawsuitHeatmap'
import { MiniDimCard } from './MiniDimCard'
import { NarrativeCard } from './NarrativeCard'
import { RelationGraph } from './RelationGraph'
import { SentimentCurve } from './SentimentCurve'
import { AnchorNav } from './AnchorNav'
import { MetaStrip } from './MetaStrip'
import { MarketZone } from './market/MarketZone'
import { SectionShell } from './detail/SectionShell'
import { FinancialSection } from './detail/FinancialSection'
import { EquitySection, PledgeSummary } from './detail/EquitySection'
import { LegalSection } from './detail/LegalSection'
import { SentimentSection } from './detail/SentimentSection'
import { NetworkSection } from './detail/NetworkSection'
import { EvidenceSection } from './detail/EvidenceSection'
import { AiSection } from './detail/AiSection'
import { ShareCard } from '@/components/share/ShareCard'
import { AiGlanceCard } from './AiGlanceCard'
import { useSentiment } from './useSentiment'
import { detailOrder, glanceLayout, narrativeOf } from '@/lib/narrative'
import type { DetailSectionId, GlanceSlot } from '@/lib/narrative'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay, NarrativeKey, SentimentSnapshot } from '@/lib/types'
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

const SLOT_KEY: Record<GlanceSlot, NarrativeKey> = {
  finance: 'hp', equity: 'def', legal: 'atk', sentiment: 'morale', network: 'network',
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
    finance: <CashFlowChart hp={displayXray.hp} height={280} />,
    equity: <PledgeSummary xray={displayXray} />,
    legal: <LawsuitHeatmap timeline={displayXray.timeline} available={displayXray.atk.available !== false} height={280} />,
    sentiment: <SentimentCurve morale={displayXray.morale} height={280} loading={sentimentLoading} slow={sentimentSlow} message={sentiment?.message} />,
    network: <RelationGraph graph={displayXray.graph} centerLabel={displayXray.name} height={280} />,
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      {/* 顶栏（仅 LITE；PRO 的操作已并入概要头右侧操作列） */}
      {mode === 'lite' && (
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/"><ArrowLeft /> 重新扫描</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/compare"><GitCompareArrows /> 双公司对比</Link>
          </Button>
          {!health && <ShareCard xray={xray} />}
        </div>
      </div>
      )}

      {/* 头：PRO 元信息条；LITE 角色横幅 + 右侧五维紧凑卡竖列 */}
      {mode === 'pro' ? (
        <motion.div variants={rise} custom={0} initial="hidden" animate="show">
          <MetaStrip xray={displayXray} />
        </motion.div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,350px)]">
          <motion.div variants={rise} custom={0} initial="hidden" animate="show" className="min-w-0">
            <CharacterCard xray={displayXray} />
          </motion.div>
          <div className="min-w-0 space-y-4">
            {order.map((id, i) => {
              const k = LITE_SECTION_KEY[id]
              return k ? (
                <motion.div key={id} variants={rise} custom={1 + i} initial="hidden" animate="show">
                  <NarrativeCard id={`detail-${id}`} k={k} xray={displayXray} compact />
                </motion.div>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* 行情与资金区（PRO 专属） */}
      {mode === 'pro' && (
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
                    ? <AttributeRadar xray={displayXray} height={560} />
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
            <motion.div variants={rise} custom={2 + layout.rest.length} initial="hidden" animate="show" className="h-full">
              {health ? <Card className="h-full"><CardHeader><CardTitle>AI 速览</CardTitle></CardHeader><CardContent><MissingMetric label="AI 分析所需证据" /></CardContent></Card> : <AiGlanceCard xray={xray} />}
            </motion.div>
          </div>
      </div>
      )}

      {/* LITE 速览层 */}
      {mode === 'lite' && (
      <div className="mt-6">
        <div className="grid gap-6 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          <motion.div variants={rise} custom={1} initial="hidden" animate="show" className="min-w-0 lg:col-span-2">
            {layout.c === 'radar' ? (
              <Card className="h-full">
                <CardHeader><CardTitle>{terms.cardTitles.radar}</CardTitle></CardHeader>
                <CardContent>{health ? <MissingEvidencePanel health={health} /> : <AttributeRadar xray={xray} height={380} />}</CardContent>
              </Card>
            ) : (
              <NarrativeCard id="glance-c" k={SLOT_KEY[layout.c]} xray={xray} />
            )}
          </motion.div>
          {layout.rest
            .filter((s) => s !== 'network')
            .slice(0, 3)
            .map((slot, i) => (
              <motion.div key={slot} variants={rise} custom={2 + i} initial="hidden" animate="show">
                {health ? <Card className="h-full"><CardHeader><CardTitle>{slotTitle(slot, terms)}</CardTitle></CardHeader><CardContent>{proCharts[slot]}</CardContent></Card> : <MiniDimCard id={`glance-${slot}`} k={SLOT_KEY[slot]} xray={xray} />}
              </motion.div>
            ))}
        </div>
      </div>
      )}

      {/* 维度层（规格 §3.4）：仅 PRO；LITE 的维度卡已并入上方横幅右侧竖列 */}
      {mode === 'pro' && (
      <div className="mt-10">
        <h2 className="mb-4 font-mono text-xs tracking-[0.3em] text-slate-500">
          {mode === 'pro' ? 'DETAIL REPORT' : '慢慢看 · 每个部分的详情'}
        </h2>

        {mode === 'pro' ? (
          <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
            <AnchorNav items={order.map((id) => ({ id, label: terms.sections[id] }))} />
            <div className="min-w-0 space-y-6">
              {order.map((id) => (
                <SectionShell key={id} id={id} title={terms.sections[id]}>
                  <SectionBody id={id} xray={displayXray} health={health} sentiment={sentiment} sentimentLoading={sentimentLoading} sentimentSlow={sentimentSlow} />
                </SectionShell>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
            {order.map((id) => {
              const k = LITE_SECTION_KEY[id]
              return k ? health ? <SectionShell key={id} id={`detail-${id}`} title={terms.sections[id]}><SectionBody id={id} xray={displayXray} health={health} sentiment={sentiment} sentimentLoading={sentimentLoading} sentimentSlow={sentimentSlow} /></SectionShell> : <NarrativeCard key={id} id={`detail-${id}`} k={k} xray={xray} /> : null
            })}
          </div>
        )}
      </div>
      )}

      {health && mode === 'lite' && <div className="mt-8"><SectionShell id="evidence" title="来源与资料缺口"><MissingEvidencePanel health={health} /></SectionShell></div>}

      <footer className="mt-10 text-center font-mono text-[11px] text-slate-600">
        HERMES · 所有结论均可点开证据溯源 · 数据仅供演示，不构成投资建议
      </footer>

      <EvidenceDrawer />
    </main>
  )
}

/** PRO section 内容（顺序由 detailOrder 版式传导） */
function SectionBody({ id, xray, health, sentiment, sentimentLoading, sentimentSlow }: {
  id: DetailSectionId
  xray: CompanyXRay
  health?: CompanyHealth
  sentiment?: SentimentSnapshot
  sentimentLoading: boolean
  sentimentSlow: boolean
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
    case 'ai': return <AiSection />
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
