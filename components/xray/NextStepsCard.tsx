'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { CompanyXRay } from '@/lib/types'

/** LLM「下一步」行动建议区块：场景标签 + 编号清单 + 诚实标注行（规格：报告页 NEXT STEPS） */
export function NextStepsCard({ nextSteps }: { nextSteps: NonNullable<CompanyXRay['nextSteps']> }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="font-mono text-xs tracking-[0.3em] text-slate-500">NEXT STEPS · 场景：{nextSteps.scenario}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-200">
          {nextSteps.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          {nextSteps.caveat} · 由 AI 生成 · {nextSteps.generatedAt.slice(0, 10)}
        </p>
      </CardContent>
    </Card>
  )
}
