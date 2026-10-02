'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Swords } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PRESET_COMPANIES } from '@/lib/presets'
import { useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

type Slot = 'A' | 'B'

/**
 * 双公司对比（加分项）—— 基线实现：并排角色卡 + 四维条形对照。
 * TODO(feat/frontend-xray)：叠加双雷达、风险分项 diff、胜负判定动画。
 */
export default function ComparePage() {
  const t = useTokens()
  const [pick, setPick] = useState<Record<Slot, string>>({ A: 'mock-healthy', B: 'mock-danger' })
  const [result, setResult] = useState<Record<Slot, CompanyXRay> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, b] = await Promise.all(
        (['A', 'B'] as Slot[]).map(async (s) => {
          const res = await fetch(`/api/company/${pick[s]}/xray`)
          if (!res.ok) throw new Error(`公司 ${s} 数据获取失败`)
          return (await res.json()) as CompanyXRay
        }),
      )
      setResult({ A: a, B: b })
    } catch (e) {
      setError(e instanceof Error ? e.message : '对比失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/"><ArrowLeft /> 返回</Link>
        </Button>
        <h1 className="text-glow text-xl font-bold text-slate-100">双公司对战</h1>
        <div className="w-16" />
      </div>

      <div className="glass-card mb-8 flex flex-wrap items-end justify-center gap-4 p-6">
        {(['A', 'B'] as Slot[]).map((slot) => (
          <label key={slot} className="flex flex-col gap-1.5 font-mono text-xs text-slate-400">
            PLAYER {slot}
            <select
              value={pick[slot]}
              onChange={(e) => setPick((p) => ({ ...p, [slot]: e.target.value }))}
              className="rounded-btn border border-neon/30 bg-ink-card px-3 py-2 text-sm text-slate-100 focus:outline-none"
            >
              {PRESET_COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        ))}
        <Button onClick={run} disabled={loading || pick.A === pick.B} size="lg">
          <Swords /> {loading ? '分析中…' : '开战'}
        </Button>
      </div>
      {pick.A === pick.B && <p className="mb-6 text-center font-mono text-xs text-warn">请选择两家不同的公司</p>}
      {error && <p className="mb-6 text-center font-mono text-xs text-danger">{error}</p>}

      {result && (
        <div className="grid gap-6 md:grid-cols-2">
          {(['A', 'B'] as Slot[]).map((slot, i) => {
            const x = result[slot]
            const color = t.riskColor[x.overallRisk]
            return (
              <motion.section
                key={slot}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6"
                style={{ borderColor: `${color}55` }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-50">{x.name}</h2>
                  <Badge variant={x.overallRisk === 'green' ? 'safe' : x.overallRisk === 'yellow' ? 'warn' : 'danger'}>
                    RISK {x.riskScore}
                  </Badge>
                </div>
                <p className="mb-5 text-xs leading-relaxed text-slate-400">{x.verdict}</p>
                <div className="space-y-3 font-mono text-xs">
                  {([
                    ['HP 血量', x.hp.score],
                    ['DEF 护甲', x.def.score],
                    ['ATK 涉诉', x.atk.score],
                    ['士气', x.morale.score],
                  ] as const).map(([label, score]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-slate-400">{label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-ink-card">
                        <motion.div
                          className="h-full rounded"
                          style={{ background: score >= 60 ? '#00E58A' : score >= 30 ? '#FFB020' : '#FF3B5C' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 0.9, delay: 0.2 + i * 0.1 }}
                        />
                      </div>
                      <span className="w-8 text-right text-slate-200">{score}</span>
                    </div>
                  ))}
                </div>
              </motion.section>
            )
          })}
        </div>
      )}
    </main>
  )
}
