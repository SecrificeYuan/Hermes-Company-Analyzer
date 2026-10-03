// components/compare/CompareInsightCard.tsx
'use client'

import { useCallback } from 'react'
import { RotateCcw, Swords } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Markdown } from '@/components/chat/Markdown'
import { LlmPlaceholder } from './LlmPlaceholder'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import { useLlmFieldStream } from '@/lib/hooks/use-llm-field-stream'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

/**
 * 对比页 AI 深度对比卡（PRO 流程第二位）：
 * - 经 useLlmFieldStream 拉 /api/compare-ai?a=&b=（SSE 字段级 + sqlite 快照缓存）
 * - 字段顺序：summary（整体归因）→ verdict（一句话定胜负）→ dimensionNotes（五维归因）
 * - LLM 未配置时回退原 LlmPlaceholder；生成失败兜底一行小字，不拖垮下方指标对比
 */
const DIMENSION_ORDER: NarrativeKey[] = ['hp', 'def', 'atk', 'morale', 'network']

export function CompareInsightCard({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const mode = useMode()
  const t = useTokens()
  const terms = getTerms(mode)
  const titles = terms.dimensionTitles

  const expand = useCallback((field: string, text: string) => {
    if (field !== 'dimensionNotes') return null
    try {
      const notes = JSON.parse(text) as Partial<Record<NarrativeKey, string>>
      return DIMENSION_ORDER.filter((k) => notes[k]).map((k) => ({ slot: `note.${k}`, text: notes[k] as string }))
    } catch {
      return []
    }
  }, [])

  const { llmUp, failed, meta, display, valueOf, regenerate, regenerating } = useLlmFieldStream(
    `/api/compare-ai?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`,
    { expand },
  )

  const summaryVal = valueOf('summary')
  const verdictVal = valueOf('verdict')
  const hasContent = display.summary !== undefined

  // LLM 未配置：维持原占位卡（提示语已改为「配置后解锁」）
  if (llmUp !== true) return <LlmPlaceholder />

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.3em] text-slate-500">
            AI 深度对比 · DEEP COMPARE
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

        {/* 失败且无任何内容：降级占位 */}
        {failed && !hasContent ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            AI 深度对比暂时不可用，可先查看下方关键指标对比与风险事件对比。
          </p>
        ) : (
          <>
            {/* 一句话定胜负 */}
            <p className="mt-3 flex min-h-6 items-center gap-2 text-base font-bold" style={{ color: t.colors.accent }}>
              <Swords className="h-4 w-4 shrink-0" />
              <span>
                {verdictVal ?? summaryVal ?? 'AI 正在对比两家公司…'}
                {verdictVal !== undefined && display.verdict === undefined && (
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-grape/80" />
                )}
              </span>
            </p>

            {/* 整体归因：真流式 markdown */}
            {summaryVal !== undefined && (
              <div className="mt-2.5">
                <Markdown text={summaryVal} />
                {display.summary === undefined && (
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-grape/80" />
                )}
              </div>
            )}

            {/* 五维归因 */}
            <dl className="mt-4 space-y-3">
              {DIMENSION_ORDER.map((k) => {
                const v = valueOf(`note.${k}`)
                if (v === undefined) return null
                return (
                  <div key={k} className="flex gap-3">
                    <dt className="w-16 shrink-0 pt-px text-xs text-slate-500">
                      {titles[k]}
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
          </>
        )}

        {/* 底部：生成信息 */}
        {meta && (
          <div className="mt-4 border-t border-edge pt-3 text-right">
            <span className="font-mono text-[10px] text-slate-600">
              {meta.model} · {meta.generatedAt.slice(0, 10)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
