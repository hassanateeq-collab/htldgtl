import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Optional trailing count or amount. */
  meta?: ReactNode
  disabled?: boolean
}

interface SegmentedProps<T extends string> {
  value: T | null
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  ariaLabel: string
  /** Wrap onto several lines instead of scrolling horizontally. */
  wrap?: boolean
  className?: string
}

/**
 * Single-choice chips for short option sets (payment method, list filters,
 * booking source). A radiogroup for assistive tech; 44px targets; scrolls
 * horizontally on phones unless `wrap` is set.
 */
export function Segmented<T extends string>({ value, onChange, options, ariaLabel, wrap, className }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex gap-2', wrap ? 'flex-wrap' : '-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]', className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-touch shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
              selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground hover:bg-accent',
            )}
          >
            {opt.label}
            {opt.meta !== undefined && (
              <span className={cn('tnum text-xs', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{opt.meta}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
