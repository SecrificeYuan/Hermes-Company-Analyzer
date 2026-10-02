'use client'

import { useCountUp } from '@/lib/hooks/use-count-up'
import { cn } from '@/lib/utils'

/** 等宽数字 + 滚动计数动画（终端感关键细节） */
export function StatNumber({
  value,
  suffix,
  decimals = 0,
  className,
  duration,
}: {
  value: number
  suffix?: string
  decimals?: number
  className?: string
  duration?: number
}) {
  const ref = useCountUp(value, duration, decimals)
  return (
    <span className={cn('font-mono tabular-nums', className)}>
      <span ref={ref}>0</span>
      {suffix && <span className="ml-0.5 text-[0.75em] opacity-70">{suffix}</span>}
    </span>
  )
}
