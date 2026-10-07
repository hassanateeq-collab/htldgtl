import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />
}

export function CardHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 pt-4', className)}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {action}
    </div>
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4 pt-3', className)} {...props} />
}

/** Label on the left, value on the right; values are tabular for numbers. */
export function DefinitionRow({ label, value, className, emphasis }: { label: ReactNode; value: ReactNode; className?: string; emphasis?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5 text-base', className)}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('tnum min-w-0 text-right', emphasis ? 'font-semibold' : 'font-medium')}>{value}</dd>
    </div>
  )
}

export function DefinitionList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-border/70', className)}>{children}</dl>
}
