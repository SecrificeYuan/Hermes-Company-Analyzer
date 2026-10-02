'use client'

import { useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTokens } from '@/lib/theme/use-tokens'
import { scoreColor } from '@/lib/theme'
import type { CompanyXRay } from '@/lib/types'

/**
 * 分享卡：把隐藏的分享卡片渲染成 PNG 下载（html2canvas）。
 * 分享卡本身屏外渲染，保证导出图与页面滚动位置无关。
 */
export function ShareCard({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const color = t.riskColor[xray.overallRisk]
  const attributes = [
    { label: 'HP', value: String(xray.hp.score), score: xray.hp.score, available: true },
    { label: 'DEF', value: String(xray.def.score), score: xray.def.score, available: true },
    {
      label: 'ATK',
      value: xray.atk.available === false ? '待核验' : String(xray.atk.score),
      score: xray.atk.score,
      available: xray.atk.available !== false,
    },
    {
      label: '士气',
      value: xray.morale.available === false ? '待加载' : String(xray.morale.score),
      score: xray.morale.score,
      available: xray.morale.available !== false,
    },
  ]

  const exportPng = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#070B14', scale: 2 })
      const a = document.createElement('a')
      a.download = `hermes-xray-${xray.id}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={exportPng} variant="outline" disabled={busy}>
        <Share2 /> {busy ? '生成中…' : '生成分享卡 PNG'}
      </Button>

      {/* 屏外渲染的分享卡（1200×630，适配社交媒体） */}
      <div className="pointer-events-none fixed left-[-2000px] top-0">
        <div
          ref={cardRef}
          className="bg-grid flex h-[630px] w-[1200px] flex-col justify-between bg-ink-bg p-14"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm tracking-[0.4em] text-neon">HERMES · 公司 X 光片</div>
              <div className="font-mono text-xs text-slate-500">{xray.generatedAt.slice(0, 10)}</div>
            </div>
            <h1 className="mt-10 text-6xl font-bold text-slate-50">{xray.name}</h1>
            <div className="mt-3 font-mono text-lg text-slate-400">
              {xray.stockCode} · {xray.industry}
            </div>
            <p className="mt-8 max-w-3xl text-2xl leading-relaxed text-slate-200">{xray.verdict}</p>
          </div>

          <div className="flex items-end justify-between">
            <div className="flex gap-10 font-mono">
              {attributes.map((attribute) => (
                <div key={attribute.label}>
                  <div className="text-xs tracking-[0.3em] text-slate-500">{attribute.label}</div>
                  <div className="mt-1 text-5xl font-bold" style={{ color: attribute.available ? scoreColor(t, attribute.score) : t.colors.textDim }}>
                    {attribute.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right">
              <div className="font-mono text-xs tracking-[0.3em] text-slate-500">RISK SCORE</div>
              <div className="text-8xl font-bold" style={{ color }}>{xray.riskScore}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
