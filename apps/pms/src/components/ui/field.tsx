import { createContext, useContext, useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldContextValue {
  id: string
  describedBy: string | undefined
  invalid: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

export function useFieldContext() {
  return useContext(FieldContext)
}

interface FieldProps {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean
  className?: string
  children: ReactNode
}

/**
 * Label + control + hint/error, wired together with ids so every input is
 * announced correctly. Controls inside read the context for their id and
 * aria-describedby; errors render with role="alert".
 */
export function Field({ label, hint, error, required, hideLabel, className, children }: FieldProps) {
  const base = useId()
  const id = `${base}-control`
  const hintId = hint ? `${base}-hint` : undefined
  const errorId = error ? `${base}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn('space-y-1.5', className)}>
        <label htmlFor={id} className={cn('block text-sm font-medium text-foreground', hideLabel && 'sr-only')}>
          {label}
          {required && (
            <span className="ml-0.5 text-due" aria-hidden>
              *
            </span>
          )}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}
