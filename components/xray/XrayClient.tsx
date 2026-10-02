'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, GitCompareArrows } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AttributeRadar } from './AttributeRadar'
import { CashFlowChart } from './CashFlowChart'
import { CharacterCard } from './CharacterCard'
import { EvidenceDrawer } from './EvidenceDrawer'
import { LawsuitHeatmap } from './LawsuitHeatmap'
import { RelationGraph } from './RelationGraph'
import { RiskTimeline } from './RiskTimeline'
import { SentimentCurve } from './SentimentCurve'
import { VerdictBanner } from './VerdictBanner'
import { ShareCard } from '@/components/share/ShareCard'
import type { CompanyXRay } from '@/lib/types'

const section = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.12 + i * 0.05, duration: 0.5 } }),
}

/**
 * 报告页客户端容器：统一入场编排（stagger 0.05s）+ 证据抽屉状态。
 * 所有模块只消费 CompanyXRay。
 */
export function XrayClient({ xray }: { xray: CompanyXRay }) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      {/* 导航 */}
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

      {/* 一句话诊断 */}
      <motion.div variants={section} custom={0} initial="hidden" animate="show">
        <VerdictBanner xray={xray} />
      </motion.div>

      {/* 角色卡 + 图表矩阵 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <motion.div variants={section} custom={1} initial="hidden" animate="show">
          <CharacterCard xray={xray} />
        </motion.div>

        <div className="grid gap-6 lg:col-span-2 lg:grid-cols-2">
          <motion.div variants={section} custom={2} initial="hidden" animate="show">
            <Card className="h-full">
              <CardHeader><CardTitle>五维属性雷达</CardTitle></CardHeader>
              <CardContent><AttributeRadar xray={xray} /></CardContent>
            </Card>
          </motion.div>
          <motion.div variants={section} custom={3} initial="hidden" animate="show">
            <Card className="h-full">
              <CardHeader><CardTitle>经营现金流趋势</CardTitle></CardHeader>
              <CardContent><CashFlowChart hp={xray.hp} /></CardContent>
            </Card>
          </motion.div>
          <motion.div variants={section} custom={4} initial="hidden" animate="show">
            <Card className="h-full">
              <CardHeader><CardTitle>诉讼热力图</CardTitle></CardHeader>
              <CardContent><LawsuitHeatmap timeline={xray.timeline} /></CardContent>
            </Card>
          </motion.div>
          <motion.div variants={section} custom={5} initial="hidden" animate="show">
            <Card className="h-full">
              <CardHeader><CardTitle>舆情情绪曲线</CardTitle></CardHeader>
              <CardContent><SentimentCurve morale={xray.morale} /></CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* 风险时间轴 */}
      <motion.div variants={section} custom={6} initial="hidden" animate="show" className="mt-6">
        <Card>
          <CardHeader><CardTitle>风险时间轴 · 近 12 个月</CardTitle></CardHeader>
          <CardContent><RiskTimeline timeline={xray.timeline} /></CardContent>
        </Card>
      </motion.div>

      {/* 关系图谱 */}
      <motion.div variants={section} custom={7} initial="hidden" animate="show" className="mt-6">
        <Card>
          <CardHeader><CardTitle>关系图谱</CardTitle></CardHeader>
          <CardContent><RelationGraph graph={xray.graph} /></CardContent>
        </Card>
      </motion.div>

      <footer className="mt-10 text-center font-mono text-[11px] text-slate-600">
        HERMES · 所有结论均可点开证据溯源 · 数据仅供演示，不构成投资建议
      </footer>

      {/* 证据抽屉（点击隐藏状态弹出） */}
      <EvidenceDrawer />
    </main>
  )
}
