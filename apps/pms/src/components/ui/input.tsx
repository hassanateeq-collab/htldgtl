import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFieldContext } from './field'

export const controlClass =
  'w-full rounded-md border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-due'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, id, ...props }, ref) => {
    const field = useFieldContext()
    return (
      <input
        ref={ref}
        id={id ?? field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(controlClass, 'h-touch', className)}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, id, ...props }, ref) => {
    const field = useFieldContext()
    return (
      <textarea
        ref={ref}
        id={id ?? field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(controlClass, 'min-h-24 py-2', className)}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

/** Native select: the right control on phones for lists longer than five options. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, id, children, ...props }, ref) => {
    const field = useFieldContext()
    return (
      <div className="relative">
        <select
          ref={ref}
          id={id ?? field?.id}
          aria-describedby={field?.describedBy}
          aria-invalid={field?.invalid || undefined}
          className={cn(controlClass, 'h-touch appearance-none pr-10', className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    )
  },
)
Select.displayName = 'Select'

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  currency?: string
}

/** Rupee amounts: numeric keypad, currency adornment, digits only (whole rupees). */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, value, onChange, currency = 'PKR', ...props }, ref) => {
    const field = useFieldContext()
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
          {currency}
        </span>
        <input
          ref={ref}
          id={props.id ?? field?.id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={field?.describedBy}
          aria-invalid={field?.invalid || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
          className={cn(controlClass, 'tnum h-touch pl-14 text-right', className)}
          {...props}
        />
      </div>
    )
  },
)
MoneyInput.displayName = 'MoneyInput'
