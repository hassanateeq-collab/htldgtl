import { useState } from 'react'
import { formatPKR, t, type PaymentMethod } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, MoneyInput, Select } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/feedback'
import { useTenant } from '@/data/tenant'
import { usePostFolioItem } from '@/data/folio'
import type { BookingVM, FolioCategory, FolioItemKind } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { categoryLabel, kindLabel } from '@/lib/labels'
import { PaymentMethodChips } from './fields'

interface Props {
  booking: BookingVM
  mode: 'payment' | 'charge'
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CHARGE_CATEGORIES: FolioCategory[] = ['food', 'laundry', 'minibar', 'extra', 'fee', 'other']

/** Collect a payment / record a refund, or add a charge / discount — with the hotel's quick charges. */
export function PostItemSheet({ booking: b, mode, open, onOpenChange }: Props) {
  const { settings } = useTenant()
  const post = usePostFolioItem()
  const balance = b.folio?.balance ?? 0

  // The sheet is mounted only while open, so initial state is per opening.
  const [kind, setKind] = useState<FolioItemKind>(mode === 'payment' ? 'payment' : 'charge')
  const [amount, setAmount] = useState(mode === 'payment' && balance > 0 ? String(balance) : '')
  const [method, setMethod] = useState<PaymentMethod | null>('cash')
  const [reference, setReference] = useState('')
  const [category, setCategory] = useState<FolioCategory>('food')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const value = Number(amount) || 0
  const money = kind === 'payment' || kind === 'refund'

  async function submit() {
    setError(null)
    if (!b.folio || value <= 0) return
    if (money && !method) return
    try {
      await post.mutateAsync({
        bookingId: b.id,
        folioId: b.folio.id,
        kind,
        category: money ? (kind === 'payment' ? 'settlement' : 'other') : category,
        description: money ? kindLabel(kind) : description.trim() || categoryLabel(category),
        amountPkr: value,
        method: money ? method : null,
        reference: money ? reference.trim() || null : null,
      })
      toast.success(
        kind === 'payment'
          ? t('toast.paymentPosted', { amount: formatPKR(value) })
          : kind === 'refund'
            ? t('toast.refundPosted', { amount: formatPKR(value) })
            : kind === 'discount'
              ? t('toast.discountPosted', { amount: formatPKR(value) })
              : t('toast.chargePosted', { label: description.trim() || categoryLabel(category) }),
      )
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const kinds: FolioItemKind[] = mode === 'payment' ? ['payment', 'refund'] : ['charge', 'discount']

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'payment' ? t('folio.collect') : t('folio.addCharge')}
      busy={post.isPending}
      footer={
        <Button className="w-full" size="lg" onClick={() => void submit()} loading={post.isPending} disabled={value <= 0 || (money && !method)}>
          {t('folio.save')} · {formatPKR(value)}
        </Button>
      }
    >
      <div className="space-y-5">
        <Segmented ariaLabel={t('folio.kind')} value={kind} onChange={setKind} wrap options={kinds.map((k) => ({ value: k, label: kindLabel(k) }))} />

        {!money && settings.chargePresets.length > 0 && kind === 'charge' && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('folio.presets')}</h3>
            <div className="flex flex-wrap gap-2">
              {settings.chargePresets.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  onClick={() => {
                    setAmount(String(p.amount))
                    setCategory(p.category)
                    setDescription(p.label)
                  }}
                >
                  {p.label} · {formatPKR(p.amount)}
                </Button>
              ))}
            </div>
          </section>
        )}

        <Field label={t('folio.amount')} required>
          <MoneyInput value={amount} onChange={setAmount} autoFocus={mode === 'charge'} />
        </Field>
        {money && balance > 0 && kind === 'payment' && value !== balance && (
          <Button variant="link" onClick={() => setAmount(String(balance))}>
            {t('checkout.payNow', { amount: formatPKR(balance) })}
          </Button>
        )}

        {money ? (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('folio.method')}</h3>
              <PaymentMethodChips value={method} onChange={setMethod} />
            </section>
            {method !== 'cash' && (
              <Field label={t('folio.reference')} hint={t('folio.referenceHint')}>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </Field>
            )}
          </>
        ) : (
          <>
            <Field label={t('folio.category')}>
              <Select value={category} onChange={(e) => setCategory(e.target.value as FolioCategory)}>
                {CHARGE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('folio.description')}>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={categoryLabel(category)} />
            </Field>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}
