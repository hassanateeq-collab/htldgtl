import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        confirmed: 'border-transparent bg-status-confirmed-bg text-status-confirmed-fg',
        inhouse: 'border-transparent bg-status-inhouse-bg text-status-inhouse-fg',
        departed: 'border-transparent bg-status-departed-bg text-status-departed-fg',
        cancelled: 'border-status-cancelled bg-status-cancelled-bg text-status-cancelled-fg',
        noshow: 'border-transparent bg-status-noshow-bg text-status-noshow-fg',
        due: 'border-due-border bg-due-bg text-due',
        credit: 'border-transparent bg-credit-bg text-credit',
        settled: 'border-transparent bg-status-inhouse-bg text-settled',
        warning: 'border-warning-border bg-warning-bg text-warning',
        'hk-clean': 'border-transparent bg-hk-clean-bg text-hk-clean',
        'hk-inspected': 'border-transparent bg-hk-inspected-bg text-hk-inspected',
        'hk-dirty': 'border-transparent bg-hk-dirty-bg text-hk-dirty',
        'hk-ooo': 'border-transparent bg-hk-ooo-bg text-hk-ooo',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
