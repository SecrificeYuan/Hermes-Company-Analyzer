import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider transition-colors',
  {
    variants: {
      variant: {
        neon: 'border-neon/40 bg-neon/10 text-neon',
        safe: 'border-safe/40 bg-safe/10 text-safe',
        warn: 'border-warn/40 bg-warn/10 text-warn',
        danger: 'border-danger/40 bg-danger/10 text-danger',
        dim: 'border-slate-600/50 bg-slate-700/20 text-slate-400',
        grape: 'border-grape/40 bg-grape/10 text-grape',
      },
    },
    defaultVariants: { variant: 'neon' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
