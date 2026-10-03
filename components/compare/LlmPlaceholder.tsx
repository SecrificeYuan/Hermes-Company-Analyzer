// components/compare/LlmPlaceholder.tsx
'use client'

import { Sparkles } from 'lucide-react'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'

/** LLM 未配置时的深度对比降级卡（功能本体见 CompareInsightCard） */
export function LlmPlaceholder() {
  const t = useTokens()
  const terms = getTerms(useMode()).compare
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed px-6 py-10 text-center"
      style={{ borderColor: `${t.colors.accent}66`, background: `${t.colors.accent}0A` }}
    >
      <Sparkles className="h-5 w-5" style={{ color: t.colors.accent }} />
      <div className="text-sm font-semibold" style={{ color: t.colors.textMain }}>{terms.llmTitle}</div>
      <div className="font-mono text-[11px]" style={{ color: t.colors.textDim }}>{terms.llmHint}</div>
    </div>
  )
}
