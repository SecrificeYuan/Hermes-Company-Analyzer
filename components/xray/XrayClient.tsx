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
import { detailOrder, glanceLayout, narrativeOf } from '@/lib/narrative'
import type { DetailSectionId, GlanceSlot } from '@/lib/narrative'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

const rise = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.12 + i * 0.05, duration: 0.5 } }),
}

const SLOT_KEY: Record<GlanceSlot, NarrativeKey> = {
  finance: 'hp', equity: 'def', legal: 'atk', sentiment: 'morale', network: 'network',
}

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
export function XrayClient({ xray }: { xray: CompanyXRay }) {
  const mode = useMode()
  const terms = getTerms(mode)
  const narrative = narrativeOf(xray)
  const layout = glanceLayout(xray, narrative)
  const order = detailOrder(layout)

  const proCharts: Record<GlanceSlot, ReactNode> = {
    finance: <CashFlowChart hp={xray.hp} height={280} />,
    equity: <PledgeSummary xray={xray} />,
    legal: <LawsuitHeatmap timeline={xray.timeline} height={280} />,
    sentiment: <SentimentCurve morale={xray.morale} height={280} />,
    network: <RelationGraph graph={xray.graph} height={280} />,
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      {/* 顶栏 */}
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/"><ArrowLeft /> 重新扫描</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/compare"><GitCompareArrows /> 双公司对比</Link>
          </Button>
          <ShareCard xray={xray} />
        </div>
      </div>

      {/* 头：LITE 角色横幅 / PRO 元信息条 */}
      <motion.div variants={rise} custom={0} initial="hidden" animate="show">
        {mode === 'pro' ? <MetaStrip xray={xray} /> : <CharacterCard xray={xray} />}
      </motion.div>

      {/* 行情与资金区（PRO 专属） */}
      {mode === 'pro' && (
        <motion.div variants={rise} custom={0.5} initial="hidden" animate="show" className="mt-6">
          <MarketZone xray={xray} />
        </motion.div>
      )}

      {/* 速览层（规格 §3.3） */}
      <div className="mt-6">
        {mode === 'pro' ? (
          <div className="grid gap-6 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
            {/* C 位：2×2 放大 */}
            <motion.div variants={rise} custom={1} initial="hidden" animate="show" className="min-w-0 lg:col-span-2 lg:row-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    {layout.c === 'radar' ? terms.cardTitles.radar : slotTitle(layout.c, terms)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {layout.c === 'radar'
                    ? <AttributeRadar xray={xray} height={560} />
                    : proCharts[layout.c]}
                </CardContent>
              </Card>
            </motion.div>
            {layout.rest.map((slot, i) => (
              <motion.div key={slot} variants={rise} custom={2 + i} initial="hidden" animate="show">
                <Card className="h-full">
                  <CardHeader><CardTitle>{slotTitle(slot, terms)}</CardTitle></CardHeader>
                  <CardContent>{proCharts[slot]}</CardContent>
                </Card>
              </motion.div>
            ))}
            {/* 右下角补位：AI 速览入口（方案 C） */}
            <motion.div variants={rise} custom={2 + layout.rest.length} initial="hidden" animate="show" className="h-full">
              <AiGlanceCard xray={xray} />
            </motion.div>
          </div>
        ) : (
          /* LITE：C 位大卡 + 3 迷你卡（其余维度取前 3，关联网络不进速览层） */
          <div className="grid gap-6 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
            <motion.div variants={rise} custom={1} initial="hidden" animate="show" className="min-w-0 lg:col-span-2">
              {layout.c === 'radar' ? (
                <Card className="h-full">
                  <CardHeader><CardTitle>{terms.cardTitles.radar}</CardTitle></CardHeader>
                  <CardContent><AttributeRadar xray={xray} height={380} /></CardContent>
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
                  <MiniDimCard id={`glance-${slot}`} k={SLOT_KEY[slot]} xray={xray} />
                </motion.div>
              ))}
          </div>
        )}
      </div>

      {/* 详读层（规格 §3.4） */}
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
                  <SectionBody id={id} xray={xray} />
                </SectionShell>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
            {order.map((id) => {
              const k = LITE_SECTION_KEY[id]
              return k ? <NarrativeCard key={id} id={`detail-${id}`} k={k} xray={xray} /> : null
            })}
          </div>
        )}
      </div>

      <footer className="mt-10 text-center font-mono text-[11px] text-slate-600">
        HERMES · 所有结论均可点开证据溯源 · 数据仅供演示，不构成投资建议
      </footer>

      <EvidenceDrawer />
    </main>
  )
}

/** PRO section 内容（顺序由 detailOrder 版式传导） */
function SectionBody({ id, xray }: { id: DetailSectionId; xray: CompanyXRay }) {
  switch (id) {
    case 'financial': return <FinancialSection xray={xray} />
    case 'equity': return <EquitySection xray={xray} />
    case 'legal': return <LegalSection xray={xray} />
    case 'sentiment': return <SentimentSection xray={xray} />
    case 'network': return <NetworkSection xray={xray} />
    case 'evidence': return <EvidenceSection xray={xray} />
    case 'ai': return <AiSection />
  }
}
