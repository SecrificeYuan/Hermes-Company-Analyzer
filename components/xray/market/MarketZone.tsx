'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AttributeRadar } from '../AttributeRadar'
import { FundFlowDonut } from './FundFlowDonut'
import { KlineChart } from './KlineChart'
import { QuoteStrip } from './QuoteStrip'
import { SentimentGauge } from './SentimentGauge'
import { useMarketData } from './useMarketData'
import { ChartEmpty } from '../EChart'
import type { CompanyXRay } from '@/lib/types'

/**
 * 「行情与资金」区（PRO 专属）：页头下新增区块。
 * 左主列：行情快照 → 日 K + 指标 → 资金流向；右副列：舆情仪表盘 → 公司简介 → 分析雷达。
 * 行情数据走 /api/market/* 客户端加载，不阻塞报告主体渲染。
 */
export function MarketZone({
  xray,
  sentimentLoading = false,
  sentimentSlow = false,
  sentimentMessage,
}: {
  xray: CompanyXRay
  sentimentLoading?: boolean
  sentimentSlow?: boolean
  sentimentMessage?: string
}) {
  const code = xray.stockCode ?? xray.id
  const { quote, kline, fflow, loading } = useMarketData(code)
  const r = xray.registry

  return (
    <div className="mt-6">
      <h2 className="mb-4 font-mono text-xs tracking-[0.3em] text-slate-500">MARKET · 行情与资金</h2>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* 左主列 */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><CardTitle>行情快照</CardTitle></CardHeader>
            <CardContent>
              {quote ? <QuoteStrip quote={quote} /> : <ChartEmpty height={120} text={loading ? '加载中' : '行情数据暂缺'} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>日 K · 前复权</CardTitle></CardHeader>
            <CardContent>
              <KlineChart bars={kline} height={380} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>资金流向（最新交易日）</CardTitle></CardHeader>
            <CardContent>
              <FundFlowDonut days={fflow} />
            </CardContent>
          </Card>
        </div>

        {/* 右副列 */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><CardTitle>舆情仪表盘</CardTitle></CardHeader>
            <CardContent>
              <SentimentGauge
                xray={xray}
                loading={sentimentLoading}
                slow={sentimentSlow}
                message={sentimentMessage}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>公司简介</CardTitle></CardHeader>
            <CardContent>
              {r ? (
                <div className="space-y-3">
                  {(r.profile || r.mainBusiness) && (
                    <p className="max-h-28 overflow-y-auto pr-1 text-xs leading-relaxed text-slate-300">
                      {r.profile ?? r.mainBusiness}
                    </p>
                  )}
                  <dl className="space-y-1.5 font-mono text-xs">
                    <Row label="公司全称" value={r.fullName} />
                    <Row label="信用代码" value={r.creditCode} />
                    <Row label="成立日期" value={r.foundedAt} />
                    <Row label="注册资本" value={`${(r.registeredCapital / 10000).toFixed(2)}亿`} />
                    <Row label="所属行业" value={xray.industry} />
                  </dl>
                  {r.sourceUrl && (
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-neon hover:underline">
                      东方财富 F10 公司概况 →
                    </a>
                  )}
                </div>
              ) : (
                <ChartEmpty height={120} text="工商信息暂缺" />
              )}
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-neon/60"
            onClick={() => document.getElementById('financial')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                分析雷达
                <span className="font-mono text-[10px] font-normal text-slate-500">DETAIL →</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AttributeRadar xray={xray} height={220} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-edge/40 pb-1.5">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-slate-300">{value}</dd>
    </div>
  )
}
