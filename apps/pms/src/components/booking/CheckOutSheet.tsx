import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatPKR, t, tNights, type PaymentMethod } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/feedback'
import { DefinitionList, DefinitionRow } from '@/components/ui/card'
import { Money } from '@/components/patterns/display'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useSetBookingStatus } from '@/data/bookings'
import { useFolio, usePostFolioItem } from '@/data/folio'
import type { BookingVM } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { addDaysStr, daysBetween } from '@/lib/clock'
import { PaymentMethodChips } from './fields'

interface Props {
  booking: BookingVM
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}

/**
 * Check-out with the money in the same sheet: what the folio says, what early
 * or late departure changes, collect or refund the difference, confirm — and
 * the owner/manager path to check out with a balance owing.
 */
export function CheckOutSheet({ booking: b, open, onOpenChange, onDone }: Props) {
  const navigate = useNavigate()
  const { property, can } = useTenant()
  const today = useHotelToday()
  const folioQ = useFolio(open ? b.id : undefined)
  const setStatus = useSetBookingStatus()
  const postItem = usePostFolioItem()

  const [method, setMethod] = useState<PaymentMethod | null>('cash')
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const folio = folioQ.data ?? null
  const projection = useMemo(() => {
    const balance = folio?.balance ?? b.folio?.balance ?? 0
    // The stay always keeps at least its first night: a same-day departure is
    // still one night's use of the room. Nights from `releaseFrom` on are unstayed.
    const releaseFrom = today > b.checkIn ? today : addDaysStr(b.checkIn, 1)
    const sameDay = today <= b.checkIn
    const unstayed = releaseFrom < b.checkOut ? daysBetween(releaseFrom, b.checkOut) : 0
    const extra = today > b.checkOut ? daysBetween(b.checkOut, today) : 0
    let released = 0
    if (unstayed > 0 && property.earlyDeparturePolicy === 'release' && folio) {
      released = folio.items
        .filter((i) => i.kind === 'charge' && i.category === 'room' && i.source === 'auto' && !i.voidedAt && i.serviceDate && i.serviceDate >= releaseFrom)
        .reduce((sum, i) => sum + i.amountPkr + i.taxPkr, 0)
    }
    const rate = b.nightlyRatePkr
    const taxFactor = property.taxMode === 'exclusive' && (property.taxAppliesTo === 'room' || property.taxAppliesTo === 'all') ? 1 + property.taxRatePct / 100 : 1
    const added = extra * rate * taxFactor
    return { balance, unstayed, extra, sameDay, projected: balance - released + added }
  }, [folio, b, today, property])

  const due = Math.max(projection.projected, 0)
  const credit = Math.max(-projection.projected, 0)
  const busy = setStatus.isPending || postItem.isPending
  const canOverride = can('checkout.override')

  async function confirm(print: boolean) {
    setError(null)
    if (!b.folio) return
    try {
      if (due > 0 && !override) {
        if (!method) return
        await postItem.mutateAsync({ bookingId: b.id, folioId: b.folio.id, kind: 'payment', category: 'settlement', description: t('category.settlement'), amountPkr: due, method, reference: null })
      } else if (credit > 0) {
        if (!method) return
        await postItem.mutateAsync({ bookingId: b.id, folioId: b.folio.id, kind: 'refund', category: 'settlement', description: t('kind.refund'), amountPkr: credit, method, reference: null })
      }
      await setStatus.mutateAsync({ bookingId: b.id, status: 'checked_out', reason: override ? reason.trim() : null })
      toast.success(t('checkout.success', { room: b.room?.label ?? '' }))
      onOpenChange(false)
      onDone?.()
      if (print) navigate(`/bookings/${b.id}/receipt`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const overrideReady = override && reason.trim().length > 0
  const needsMethod = (due > 0 && !override) || credit > 0

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('checkout.title', { name: b.guest.name })}
      description={b.room ? `${t('booking.room')} ${b.room.label}` : undefined}
      busy={busy}
      footer={
        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="lg"
            onClick={() => void confirm(false)}
            loading={busy}
            disabled={folioQ.isPending || (due > 0 && !override && !method) || (override && !overrideReady) || (credit > 0 && !method)}
          >
            {due > 0 && !override ? t('checkout.payNow', { amount: formatPKR(due) }) : credit > 0 ? t('checkout.refundNow', { amount: formatPKR(credit) }) : t('checkout.confirm')}
          </Button>
          <Button variant="outline" size="lg" onClick={() => void confirm(true)} disabled={busy || folioQ.isPending || (override && !overrideReady) || (needsMethod && !method)}>
            {t('actions.receipt')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <DefinitionList>
          <DefinitionRow label={t('folio.subtotal')} value={<Money amount={folio?.totalCharges ?? b.folio?.charges ?? 0} />} />
          {(folio?.totalTax ?? b.folio?.tax ?? 0) > 0 && <DefinitionRow label={t('folio.taxPlain')} value={<Money amount={folio?.totalTax ?? b.folio?.tax ?? 0} />} />}
          <DefinitionRow label={t('folio.paid')} value={<Money amount={folio?.totalPayments ?? b.folio?.payments ?? 0} />} />
          <DefinitionRow
            label={due > 0 ? t('checkout.balanceDue') : credit > 0 ? t('checkout.credit') : t('checkout.settled')}
            value={<Money amount={Math.abs(projection.projected)} className={due > 0 ? 'text-due' : credit > 0 ? 'text-credit' : 'text-settled'} />}
            emphasis
          />
        </DefinitionList>

        {projection.unstayed > 0 && (
          <p className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning">
            {property.earlyDeparturePolicy === 'release' ? t('checkout.early', { nights: tNights(projection.unstayed) }) : t('checkout.earlyFull')}
          </p>
        )}
        {projection.sameDay && <p className="rounded-md border border-border bg-muted p-3 text-sm">{t('checkout.minimumNight')}</p>}
        {projection.extra > 0 && <p className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning">{t('checkout.late', { nights: tNights(projection.extra) })}</p>}

        {needsMethod && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('folio.method')}</h3>
            <PaymentMethodChips value={method} onChange={setMethod} />
          </section>
        )}

        {due > 0 && canOverride && (
          <section className="space-y-3 rounded-lg border border-border p-3">
            <label className="flex min-h-touch cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              <span className="text-base font-medium">{t('checkout.override')}</span>
            </label>
            <p className="text-sm text-muted-foreground">{t('checkout.overrideHint')}</p>
            {override && (
              <Field label={t('checkout.overrideReason')} required>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </Field>
            )}
          </section>
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
