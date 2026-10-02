'use client'

import { FileSearch, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useXrayStore } from '@/lib/store'
import { useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

const META = {
  green: { Icon: ShieldCheck },
  yellow: { Icon: AlertTriangle },
  red: { Icon: ShieldAlert },
} as const

const SEV_ORDER = { high: 0, mid: 1, low: 2 } as const

/**
 * LITE 首屏灯区：全页唯一结论。headline 固定三句，reason 一句人话，
 * 黄灯附"怎么付更安全"。light 缺席（旧数据）时按 overallRisk 映射兜底。
 */
export function LightBanner({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const setActiveStatus = useXrayStore((s) => s.setActiveStatus)
  const light = xray.light ?? {
    color: xray.overallRisk,
    headline: xray.overallRisk === 'red' ? '先别付这钱' : xray.overallRisk === 'yellow' ? '能付，但换个付法' : '这钱能付',
    reason: xray.verdict.split('。')[0] + '。',
    limitedSignals: undefined,
  }
  const color = t.riskColor[light.color]
  const { Icon } = META[light.color]
  const evidence = [...xray.hiddenStatus].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])[0]

  return (
    <section className="glass-card mb-6 shrink-0 p-6" role="status" aria-live="polite"
      style={{ borderColor: `${color}55`, boxShadow: `0 0 32px ${color}22` }}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: `${color}1A`, border: `2px solid ${color}` }}>
            <Icon className="h-5 w-5" style={{ color }} />
            <span className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ background: color }} />
          </span>
          <span className="text-2xl font-extrabold tracking-wide text-slate-50">{light.headline}</span>
          {light.limitedSignals && (
            <span className="rounded-btn border border-warn/40 px-2 py-0.5 font-mono text-[10px] text-warn">基于公开信号</span>
          )}
        </span>
        <span className="min-w-0 flex-1 basis-64 text-sm leading-relaxed text-slate-300">
          {xray.llm?.lightReason ?? light.reason}
        </span>
        {evidence && (
          <Button variant="ghost" size="sm" onClick={() => setActiveStatus(evidence)}>
            <FileSearch /> 查看证据
          </Button>
        )}
      </div>
      {light.saferAdvice && (
        <p className="mt-3 border-t border-edge pt-3 text-sm text-slate-300">
          <span className="font-mono text-[10px] tracking-[0.2em] text-neon/80">怎么付更安全 </span>
          {light.saferAdvice}
        </p>
      )}
    </section>
  )
}
