'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

/**
 * 报告页 AI 点评卡（LITE/PRO 共用）：
 * - 挂载后异步拉 /api/report-ai（SSE 字段级），LLM 未配置时整块不渲染
 * - 字段到达进打字机队列逐字渲染（22ms/字），summary 最先到达
 * - LITE = summary + 灯语 + 下一步建议（吸收原 NextStepsCard）；PRO 额外渲染五维短评
 * - 生成失败的兜底是一行小字占位，不拖垮报告主体
 */
type Slot = 'summary' | 'lightReason' | `note.${NarrativeKey}`

interface QueueItem {
  slot: Slot
  text: string
}

const DIMENSION_ORDER: NarrativeKey[] = ['hp', 'def', 'atk', 'morale', 'network']
const TYPE_MS = 22

export function AiInsightCard({
  reportId,
  companyName,
  nextSteps,
  onSummary,
}: {
  reportId: string
  companyName: string
  nextSteps?: CompanyXRay['nextSteps']
  onSummary?: (summary: string) => void
}) {
  const mode = useMode()
  const terms = getTerms(mode)
  const [llmUp, setLlmUp] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)
  const [meta, setMeta] = useState<{ model: string; generatedAt: string } | null>(null)

  const queueRef = useRef<QueueItem[]>([])
  const [typing, setTyping] = useState<{ slot: Slot; full: string; len: number } | null>(null)
  const [display, setDisplay] = useState<Partial<Record<Slot, string>>>({})
  const [tick, setTick] = useState(0)
  const receivedRef = useRef(false)
  const doneRef = useRef(false)
  const onSummaryRef = useRef(onSummary)
  onSummaryRef.current = onSummary

  // 打字机消费循环：tick 驱动取队首，逐字推进，完成即落 display
  useEffect(() => {
    if (typing) {
      if (typing.len >= typing.full.length) {
        const slot = typing.slot
        setDisplay((d) => ({ ...d, [slot]: typing.full }))
        if (slot === 'summary') onSummaryRef.current?.(typing.full)
        setTyping(null)
        setTick((t) => t + 1)
      } else {
        const timer = window.setTimeout(
          () => setTyping((t) => (t ? { ...t, len: t.len + 1 } : t)),
          TYPE_MS,
        )
        return () => window.clearTimeout(timer)
      }
      return
    }
    const next = queueRef.current.shift()
    if (next) setTyping({ slot: next.slot, full: next.text, len: 0 })
  }, [typing, tick])

  // 拉取 SSE：先探测 llm-status，再读字段流；零事件兜底标失败
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const st = await fetch('/api/llm-status')
        if (!st.ok) {
          setLlmUp(false)
          return
        }
        const status: unknown = await st.json()
        if (cancelled) return
        if (!(status as { available?: boolean })?.available) {
          setLlmUp(false)
          return
        }
        setLlmUp(true)

        const res = await fetch(`/api/report-ai?reportId=${encodeURIComponent(reportId)}`)
        if (!res.ok || !res.body) {
          setFailed(true)
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const blocks = buf.split('\n\n')
          buf = blocks.pop() ?? ''
          for (const block of blocks) {
            const line = block.trim()
            if (!line.startsWith('data:')) continue
            let ev: { type?: string; field?: string; text?: string; model?: string; generatedAt?: string; message?: string }
            try {
              ev = JSON.parse(line.slice(5).trim())
            } catch {
              continue
            }
            if (ev.type === 'field' && ev.field && typeof ev.text === 'string') {
              receivedRef.current = true
              if (ev.field === 'sectionNotes') {
                try {
                  const notes = JSON.parse(ev.text) as Partial<Record<NarrativeKey, string>>
                  for (const k of DIMENSION_ORDER) {
                    if (notes[k]) queueRef.current.push({ slot: `note.${k}`, text: notes[k] as string })
                  }
                } catch {
                  // 坏 JSON 忽略该段
                }
              } else {
                queueRef.current.push({ slot: ev.field as Slot, text: ev.text })
              }
              setTick((t) => t + 1)
            } else if (ev.type === 'done') {
              doneRef.current = true
              if (ev.model && ev.generatedAt) setMeta({ model: ev.model, generatedAt: ev.generatedAt })
            } else if (ev.type === 'error') {
              setFailed(true)
            }
          }
        }
        if (!cancelled && !doneRef.current && !receivedRef.current) setFailed(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reportId])

  /** 渲染值：已完成字段 > 正在打的草稿 > undefined（未开始） */
  const valueOf = (slot: Slot): string | undefined => {
    if (display[slot] !== undefined) return display[slot]
    if (typing?.slot === slot) return typing.full.slice(0, typing.len)
    return undefined
  }
  const summaryVal = valueOf('summary')
  const lightVal = valueOf('lightReason')
  const hasContent = display.summary !== undefined

  // 未配置/探测中：不渲染（既定「无 LLM 不渲染」原则）
  if (llmUp !== true) return null

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.3em] text-slate-500">
            {mode === 'lite' ? 'AI 点评' : 'AI ANALYSIS'}
          </span>
          <Sparkles className="h-3.5 w-3.5 text-grape" />
        </div>

        {/* 失败且无任何内容：降级占位（B 方案） */}
        {failed && !hasContent ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {mode === 'lite'
              ? 'AI 小哥暂时打了个盹，点评稍后再来 🌙'
              : 'AI 分析暂时不可用，可先查看下方原始证据。'}
          </p>
        ) : (
          <>
            {/* 整体点评：最先到达，打字机逐字 */}
            <p className="mt-3 min-h-6 text-sm leading-relaxed text-slate-200">
              {summaryVal ?? 'AI 正在读这份 X 光片…'}
              {summaryVal !== undefined && display.summary === undefined && (
                <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-grape/80" />
              )}
            </p>

            {/* 灯语一句话解释 */}
            {lightVal !== undefined && (
              <p className="mt-2.5 border-l-2 border-warn/60 pl-2.5 text-xs leading-relaxed text-warn/90">
                {lightVal}
                {display.lightReason === undefined && (
                  <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 animate-pulse bg-warn/70" />
                )}
              </p>
            )}

            {/* PRO：五维短评 */}
            {mode === 'pro' && (
              <dl className="mt-4 space-y-3">
                {DIMENSION_ORDER.map((k) => {
                  const v = valueOf(`note.${k}`)
                  if (v === undefined) return null
                  return (
                    <div key={k} className="flex gap-3">
                      <dt className="w-16 shrink-0 pt-px text-xs text-slate-500">
                        {terms.dimensionTitles[k]}
                      </dt>
                      <dd className="min-w-0 flex-1 text-sm leading-relaxed text-slate-300">
                        {v}
                        {display[`note.${k}`] === undefined && (
                          <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 animate-pulse bg-grape/70" />
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}

            {/* LITE：下一步行动建议（吸收原 NextStepsCard，服务端数据即时可用） */}
            {mode === 'lite' && nextSteps && (
              <div className="mt-4 border-t border-edge pt-3.5">
                <p className="font-mono text-[10px] tracking-[0.3em] text-slate-500">
                  NEXT STEPS · {nextSteps.scenario}
                </p>
                <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-300">
                  {nextSteps.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
                <p className="mt-2.5 text-xs text-slate-500">{nextSteps.caveat}</p>
              </div>
            )}
          </>
        )}

        {/* 底部：追问入口 + 生成信息 */}
        <div className="mt-4 flex items-center justify-between border-t border-edge pt-3">
          <Link
            href={`/chat?company=${encodeURIComponent(companyName)}`}
            className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-neon transition-colors hover:text-neon/80"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            追问 AI →
          </Link>
          {meta && (
            <span className="font-mono text-[10px] text-slate-600">
              {meta.model} · {meta.generatedAt.slice(0, 10)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
