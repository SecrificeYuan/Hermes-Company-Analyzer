// components/compare/CompareClient.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CharacterPanel } from '@/components/xray/CharacterPanel'
import { EvidenceDrawer } from '@/components/xray/EvidenceDrawer'
import { CompareSelector, type SlotPick } from './CompareSelector'
import { ProLoading } from './ProLoading'
import { CompareVerdictBar } from './CompareVerdictBar'
import { CompareInsightCard } from './CompareInsightCard'
import { DualRadar } from './DualRadar'
import { LiteLoading } from './LiteLoading'
import { MetricCompareTable } from './MetricCompareTable'
import { RiskCompare } from './RiskCompare'
import { TrendCompare } from './TrendCompare'
import { compareCompanyVerdict } from '@/lib/analysis/compare-verdict'
import type { CompareSelection } from '@/lib/compare-params'
import type { ListedCompany } from '@/lib/data/eastmoney'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

type Slot = 'A' | 'B'
type Pair = Record<Slot, CompanyXRay>

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.05, duration: 0.4 } }),
}

async function fetchPair(pick: Record<Slot, string>): Promise<Pair> {
  const [a, b] = await Promise.all(
    (['A', 'B'] as Slot[]).map(async (s) => {
      const res = await fetch(`/api/company/${pick[s]}/xray`)
      if (!res.ok) throw new Error(`公司 ${s} 数据获取失败`)
      return (await res.json()) as CompanyXRay
    }),
  )
  return { A: a, B: b }
}

export function CompareClient({ initialPick }: { initialPick: CompareSelection | null }) {
  const router = useRouter()
  const mode = useMode()
  const terms = getTerms(mode).compare

  const [pick, setPick] = useState<Record<Slot, SlotPick | null>>({ A: null, B: null })
  const [result, setResult] = useState<Pair | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const run = useCallback(async (sel: Record<Slot, string>) => {
    setLoading(true)
    setError(null)
    try {
      setResult(await fetchPair(sel))
    } catch (e) {
      setError(e instanceof Error ? e.message : '对比失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialPick) return
    // 双码齐全才自动开战；单码只回填该槽位，等用户挑另一家
    if (initialPick.a && initialPick.b) void run({ A: initialPick.a, B: initialPick.b })
    // URL 带参回填公司名供选择器展示
    void Promise.all(
      (['A', 'B'] as Slot[]).map(async (slot) => {
        const code = slot === 'A' ? initialPick.a : initialPick.b
        if (!code) return
        try {
          // /api/search 按 6 位纯代码精确匹配；带 .SZ 等后缀时剥掉再查
          const res = await fetch(`/api/search?q=${encodeURIComponent(code.slice(0, 6))}`)
          const data = (await res.json()) as { found: boolean; company?: ListedCompany }
          if (data.found && data.company) {
            const c = data.company
            setPick((p) => ({ ...p, [slot]: { id: c.id, name: c.name, sub: c.stockCode } }))
          }
        } catch {
          /* 名称回填失败不影响对战结果 */
        }
      }),
    )
    // 仅挂载时执行一次：URL 带参自动开战
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sameCompany = pick.A !== null && pick.A.id === pick.B?.id

  const handleRun = () => {
    if (!pick.A || !pick.B) return
    router.replace(`/compare?a=${pick.A.id}&b=${pick.B.id}`)
    void run({ A: pick.A.id, B: pick.B.id })
  }

  const handleCopy = async () => {
    if (!pick.A || !pick.B) return
    const url = `${window.location.origin}/compare?a=${pick.A.id}&b=${pick.B.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('复制失败，请手动复制：', url)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/"><ArrowLeft /> 返回</Link>
        </Button>
        <h1 className={mode === 'pro' ? 'text-xl font-semibold text-slate-100' : 'text-glow text-xl font-bold text-slate-100'}>
          {terms.title}
        </h1>
        <div className="w-16" />
      </div>

      <CompareSelector
        value={pick}
        onChange={(slot, next) => setPick((p) => ({ ...p, [slot]: next }))}
        onRun={handleRun}
        loading={loading}
        sameCompany={sameCompany}
        canCopy={!!result}
        copied={copied}
        onCopy={handleCopy}
      />

      {sameCompany && <p className="mt-4 text-center font-mono text-xs text-warn">{terms.sameCompanyHint}</p>}

      {error && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-xs text-danger">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (pick.A && pick.B) void run({ A: pick.A.id, B: pick.B.id })
            }}
          >
            <RotateCcw /> {terms.retry}
          </Button>
        </div>
      )}

      {loading && (mode === 'pro' ? <ProLoading /> : (
        <LiteLoading aName={pick.A?.name} bName={pick.B?.name} />
      ))}

      {!loading && !error && result && (mode === 'pro'
        ? <ProFlow a={result.A} b={result.B} />
        : <LiteArena a={result.A} b={result.B} />)}

      {!loading && !error && !result && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Swords className="h-8 w-8 text-neon/60" />
          <p className="font-mono text-xs text-slate-500">{terms.idleHint}</p>
        </div>
      )}

      <EvidenceDrawer />
    </main>
  )
}

function WinnerBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="absolute -top-3 right-4 z-10 rounded-btn border border-safe/50 bg-ink-card px-2.5 py-1 font-mono text-[11px] text-safe shadow-glow">
      钱付这家更稳
    </span>
  )
}

function LiteArena({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const terms = getTerms('lite').compare
  const titles = getTerms('lite').cardTitles
  const outcome = compareCompanyVerdict(a, b)

  return (
    <div className="mt-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <CompareVerdictBar a={a} b={b} />
      </motion.div>

      <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <motion.div initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
          <div className="relative">
            <WinnerBadge show={outcome === 'A'} />
            <CharacterPanel xray={a} />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="flex items-center justify-center"
        >
          <div className="rounded-full border border-neon/40 bg-ink-card px-5 py-3 text-center font-mono text-sm tracking-[0.3em] text-neon shadow-glow">
            {outcome === null || outcome === 'draw' ? 'VS' : 'K.O.'}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.16 }}>
          <div className="relative">
            <WinnerBadge show={outcome === 'B'} />
            <CharacterPanel xray={b} />
          </div>
        </motion.div>
      </div>

      <motion.div variants={fade} custom={3} initial="hidden" animate="show" className="mt-6">
        <Card>
          <CardHeader><CardTitle>{titles.radar}</CardTitle></CardHeader>
          <CardContent><DualRadar a={a} b={b} /></CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fade} custom={4} initial="hidden" animate="show" className="mt-6">
        <div className="mb-3 font-mono text-[11px] tracking-[0.25em] text-slate-500">{terms.verdictQuoteTitle}</div>
        <div className="grid gap-4 md:grid-cols-2">
          {[a, b].map((x) => {
            const light = x.light ?? {
              color: x.overallRisk,
              headline: x.overallRisk === 'red' ? '先别付这钱' : x.overallRisk === 'yellow' ? '能付，但换个付法' : '这钱能付',
              reason: x.verdict.split('。')[0] + '。',
            }
            return (
              <blockquote key={x.id} className="glass-card p-5">
                <p className="text-base font-bold" style={{ color: t.riskColor[light.color] }}>{light.headline}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{x.llm?.lightReason ?? light.reason}</p>
                <footer className="mt-3 font-mono text-[11px] text-slate-500">— {x.name}</footer>
              </blockquote>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

function ProFlow({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const terms = getTerms('pro').compare
  const titles = getTerms('pro').cardTitles

  return (
    <div className="mt-6">
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <CompareVerdictBar a={a} b={b} />
      </motion.div>
      <motion.div variants={fade} custom={1} initial="hidden" animate="show" className="mt-6">
        <CompareInsightCard a={a} b={b} />
      </motion.div>
      <motion.div variants={fade} custom={2} initial="hidden" animate="show" className="mt-6">
        <Card>
          <CardHeader><CardTitle>{titles.radar}</CardTitle></CardHeader>
          <CardContent><DualRadar a={a} b={b} /></CardContent>
        </Card>
      </motion.div>
      <motion.div variants={fade} custom={3} initial="hidden" animate="show" className="mt-6">
        <Card>
          <CardHeader><CardTitle>{terms.cardTitles.table}</CardTitle></CardHeader>
          <CardContent><MetricCompareTable a={a} b={b} /></CardContent>
        </Card>
      </motion.div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <motion.div variants={fade} custom={4} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader><CardTitle>{terms.cardTitles.trend}</CardTitle></CardHeader>
            <CardContent><TrendCompare a={a} b={b} /></CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fade} custom={5} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader><CardTitle>{terms.cardTitles.risk}</CardTitle></CardHeader>
            <CardContent><RiskCompare a={a} b={b} /></CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
