'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import type { CompanyXRay } from '@/lib/types'

/** 速览层右下角补位卡（方案 C）：AI 摘要预览 + 跳转 #ai 详读 section。
 *  liveInsight：AiInsightCard 流式生成过程中的实时回填（text 为累计全文，
 *  model/generatedAt 随 done 事件到达）；优先于 xray.llm 的预置摘要。
 *  流式预览时 line-clamp-4 逐行显现，营造"AI 正在写"的活感。 */
export function AiGlanceCard({
  xray,
  liveInsight,
}: {
  xray: CompanyXRay
  liveInsight?: { text: string; model?: string; generatedAt?: string } | null
}) {
  const text = liveInsight?.text ?? xray.llm?.summary
  const model = liveInsight?.model ?? xray.llm?.model
  const generatedAt = liveInsight?.generatedAt ?? xray.llm?.generatedAt
  const streaming = Boolean(liveInsight) && !liveInsight?.model // meta 未到达=仍在流式
  return (
    <Card
      className="h-full cursor-pointer border-dashed hover:border-neon/60"
      onClick={() => document.getElementById('ai')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          AI 速览
          <span className="flex items-center gap-1 font-mono text-[10px] font-normal text-slate-500">
            {streaming && <Loader2 className="h-3 w-3 animate-spin" />}
            AI ANALYSIS →
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {text ? (
          <>
            <p className="line-clamp-4 text-xs leading-relaxed text-slate-300">{text}</p>
            <p className="mt-3 font-mono text-[10px] text-slate-500">
              {model ? `${model} · ${(generatedAt ?? '').slice(0, 10)}` : '生成中…'}
            </p>
          </>
        ) : (
          <p className="font-mono text-xs text-slate-500">░ AI 分析待生成，可先从证据溯源查看原始材料</p>
        )}
      </CardContent>
    </Card>
  )
}
