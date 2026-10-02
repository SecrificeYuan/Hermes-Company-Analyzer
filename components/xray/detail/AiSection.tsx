'use client'
import { Sparkles } from 'lucide-react'

/** AI 分析占位（规格 §8）：接入 LLM 后渲染 summary + sectionNotes */
export function AiSection() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge py-12 text-center">
      <Sparkles className="h-6 w-6 text-slate-500" />
      <p className="text-sm text-slate-400">AI 分析能力预留 · 接入 LLM 后自动启用</p>
      <p className="font-mono text-[10px] tracking-wider text-slate-600">
        DATA FROM ENGINE · INTERPRETATION FROM AI
      </p>
    </div>
  )
}
