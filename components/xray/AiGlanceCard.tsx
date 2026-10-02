'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CompanyXRay } from '@/lib/types'

/** 速览层右下角补位卡（方案 C）：AI 摘要预览 + 跳转 #ai 详读 section。 */
export function AiGlanceCard({ xray }: { xray: CompanyXRay }) {
  const summary = xray.llm?.summary
  return (
    <Card
      className="h-full cursor-pointer border-dashed hover:border-neon/60"
      onClick={() => document.getElementById('ai')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          AI 速览
          <span className="font-mono text-[10px] font-normal text-slate-500">AI ANALYSIS →</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summary ? (
          <>
            <p className="line-clamp-4 text-xs leading-relaxed text-slate-300">{summary}</p>
            <p className="mt-3 font-mono text-[10px] text-slate-500">
              {xray.llm?.model} · {xray.llm?.generatedAt.slice(0, 10)}
            </p>
          </>
        ) : (
          <p className="font-mono text-xs text-slate-500">░ AI 分析待生成，可先从证据溯源查看原始材料</p>
        )}
      </CardContent>
    </Card>
  )
}
