'use client'

import { useModeStore } from '@/lib/mode-store'
import { cn } from '@/lib/utils'

/** 全站 LITE/PRO 模式开关（右上角） */
export function ModeToggle() {
  const mode = useModeStore((s) => s.mode)
  const setMode = useModeStore((s) => s.setMode)
  return (
    <div className="flex items-center rounded-btn border border-ink-edge p-0.5 font-mono text-[11px]">
      {(['lite', 'pro'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn(
            'rounded-[6px] px-3 py-1 tracking-wider transition-colors',
            mode === m ? 'bg-neon font-semibold text-ink-bg' : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {m.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
