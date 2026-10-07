import { useState, type ReactNode } from 'react'
import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'

interface ReasonSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Label for the reason field. */
  prompt: string
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  error?: string | null
  onConfirm: (reason: string) => void | Promise<void>
  children?: ReactNode
}

/** Consequential actions that need a recorded reason: cancel, no-show, void, reopen, check out owing. */
export function ReasonSheet({ open, onOpenChange, title, description, prompt, confirmLabel, destructive, busy, error, onConfirm, children }: ReasonSheetProps) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const missing = reason.trim().length === 0

  const submit = () => {
    setTouched(true)
    if (missing) return
    void onConfirm(reason.trim())
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('')
          setTouched(false)
        }
        onOpenChange(next)
      }}
      title={title}
      description={description}
      busy={busy}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} className="flex-1" onClick={submit} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {children}
        <Field label={prompt} required error={touched && missing ? t('common.reasonRequired') : error ?? null}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus />
        </Field>
      </div>
    </Sheet>
  )
}
