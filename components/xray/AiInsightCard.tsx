'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { MessageSquare, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Markdown } from '@/components/chat/Markdown'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import { useLlmFieldStream } from '@/lib/hooks/use-llm-field-stream'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

/**
 * 报告页 AI 点评卡（LITE/PRO 共用）：
 * - 挂载后经 useLlmFieldStream 异步拉 /api/report-ai（SSE 字段级），LLM 未配置时整块不渲染
 * - 字段到达进打字机队列逐字渲染（22ms/字），summary 最先到达
 * - LITE = summary + 灯语 + 下一步建议（吸收原 NextStepsCard）；PRO 额外渲染五维短评
 * - 生成失败的兜底是一行小字占位，不拖垮报告主体
 */
const DIMENSION_ORDER: NarrativeKey[] = ['hp', 'def', 'atk', 'morale', 'network']

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

  const expand = useCallback((field: string, text: string) => {
    if (field !== 'sectionNotes') return null
    try {
      const notes = JSON.parse(text) as Partial<Record<NarrativeKey, string>>
      return DIMENSION_ORDER.filter((k) => notes[k]).map((k) => ({ slot: `note.${k}`, text: notes[k] as string }))
    } catch {
      return [] // 坏 JSON：推空队列项集合，忽略该段
    }
  }, [])

  const handleSlotDone = useCallback((slot: string, text: string) => {
    if (slot === 'summary') onSummary?.(text)
  }, [onSummary])

  const { llmUp, failed, meta, display, valueOf, regenerate, regenerating } = useLlmFieldStream(
    `/api/report-ai?reportId=${encodeURIComponent(reportId)}`,
    { expand, onSlotDone: handleSlotDone },
  )

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
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            title="重新生成"
            className="flex items-center gap-1 font-mono text-[10px] tracking-wider text-grape transition-colors hover:text-grape/80 disabled:opacity-40"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? '生成中…' : '重试'}
          </button>
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
            {/* 整体点评：真流式 markdown 渲染，边到边显 */}
            <div className="mt-3 min-h-6">
              {summaryVal !== undefined ? (
                <Markdown text={summaryVal} />
              ) : (
                <p className="text-sm text-slate-400">AI 正在读这份 X 光片…</p>
              )}
              {summaryVal !== undefined && display.summary === undefined && (
                <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-grape/80" />
              )}
            </div>

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
            href={`/chat?report=${encodeURIComponent(reportId)}`}
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
