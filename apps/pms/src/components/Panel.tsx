import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Panel({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm',
        className,
      )}
    >
      {title && <h2 className="mb-2 text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  )
}
