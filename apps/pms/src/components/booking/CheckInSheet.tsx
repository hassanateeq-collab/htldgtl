import { useState } from 'react'
import { formatPKR, isCnic, t, type PaymentMethod } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { MoneyInput } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/feedback'
import { HkBadge } from '@/components/patterns/display'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useSetBookingStatus, useUpdateBooking } from '@/data/bookings'
import { useSetGuestId } from '@/data/guests'
import { usePostFolioItem } from '@/data/folio'
import type { BookingVM, IdType } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { addDaysStr, fmtMedium } from '@/lib/clock'
import { IdFields, PaymentMethodChips } from './fields'

interface Props {
  booking: BookingVM
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}

/**
 * Check-in in one sheet: room readiness, the guest's ID (required by the
 * property setting), early arrival handling, optional deposit, confirm.
 */
export function CheckInSheet({ booking: b, open, onOpenChange, onDone }: Props) {
  const { property, can } = useTenant()
  const today = useHotelToday()
  const setStatus = useSetBookingStatus()
  const setGuestId = useSetGuestId()
  const updateBooking = useUpdateBooking()
  const postItem = usePostFolioItem()

  const [idType, setIdType] = useState<IdType>('cnic')
  const [idNumber, setIdNumber] = useState('')
  const [deposit, setDeposit] = useState('')
  const [method, setMethod] = useState<PaymentMethod | null>('cash')
  const [error, setError] = useState<string | null>(null)
  const [idError, setIdError] = useState<string | null>(null)
  const [startToday, setStartToday] = useState(true)

  const needsId = !b.guest.hasId
  const idRequired = needsId && property.requireIdAtCheckIn
  const early = today < b.checkIn
  const late = today > b.checkIn
  const tomorrow = addDaysStr(today, 1)
  // The database only allows check-in while check_in <= today < check_out, so a
  // stay that should already have ended must be extended to tonight.
  const mustExtend = b.checkOut <= today
  const moveDates = early || (late && startToday) || mustExtend
  const roomOoo = b.room?.hkStatus === 'out_of_order'
  const roomDirty = b.room?.hkStatus === 'dirty'
  const depositValue = Number(deposit) || 0
  const busy = setStatus.isPending || setGuestId.isPending || updateBooking.isPending || postItem.isPending

  async function confirm() {
    setError(null)
    setIdError(null)
    if (roomOoo) return
    const idValue = idNumber.trim()
    if (needsId && (idValue || idRequired)) {
      if (!idValue) return setIdError(t('checkin.idRequired'))
      if (idType === 'cnic' && !isCnic(idValue)) return setIdError(t('guests.cnicFormat'))
    }
    try {
      if (needsId && idValue) await setGuestId.mutateAsync({ guestId: b.guest.id, idType, idNumber: idValue })
      if (moveDates && b.room) {
        await updateBooking.mutateAsync({
          bookingId: b.id,
          roomId: b.room.id,
          checkIn: early || (late && startToday) ? today : b.checkIn,
          checkOut: b.checkOut > today ? b.checkOut : tomorrow,
          adults: b.adults,
          children: b.children,
          source: b.source,
          nightlyRate: b.nightlyRatePkr,
          notes: b.notes,
        })
      }
      if (depositValue > 0 && b.folio && method) {
        await postItem.mutateAsync({
          bookingId: b.id,
          folioId: b.folio.id,
          kind: 'payment',
          category: 'deposit',
          description: t('category.deposit'),
          amountPkr: depositValue,
          method,
          reference: null,
        })
      }
      await setStatus.mutateAsync({ bookingId: b.id, status: 'checked_in' })
      toast.success(t('checkin.success', { room: b.room?.label ?? '' }))
      onOpenChange(false)
      onDone?.()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('checkin.title', { name: b.guest.name })}
      description={b.room ? t('checkin.room', { room: b.room.label, type: b.room.typeName }) : undefined}
      busy={busy}
      footer={
        <Button className="w-full" size="lg" onClick={() => void confirm()} loading={busy} disabled={roomOoo || !can('bookings.transition')}>
          {t('checkin.confirm')}
        </Button>
      }
    >
      <div className="space-y-5">
        {b.room && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm text-muted-foreground">{t('booking.room')}</p>
              <p className="tnum text-lg font-semibold">
                {b.room.label} <span className="text-base font-normal text-muted-foreground">· {b.room.typeName}</span>
              </p>
            </div>
            <HkBadge status={b.room.hkStatus} />
          </div>
        )}
        {roomOoo && (
          <p role="alert" className="rounded-md border border-due-border bg-due-bg p-3 text-sm text-due">
            {t('checkin.roomOoo', { room: b.room?.label ?? '' })}
          </p>
        )}
        {roomDirty && (
          <p className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning">{t('checkin.roomDirty', { room: b.room?.label ?? '' })}</p>
        )}
        {early && (
          <p className="rounded-md border border-border bg-muted p-3 text-sm">
            {t('checkin.earlyArrival', { date: fmtMedium(b.checkIn) })} <span className="font-medium">{t('checkin.setArrivalToday')}</span>
          </p>
        )}
        {late && (
          <div className="space-y-2 rounded-md border border-border bg-muted p-3 text-sm">
            <p className="font-medium">{t('checkin.lateArrival', { date: fmtMedium(b.checkIn) })}</p>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" checked={startToday} onChange={(e) => setStartToday(e.target.checked)} />
              <span>{t('checkin.startToday')}</span>
            </label>
            {mustExtend && <p className="text-muted-foreground">{t('checkin.extendToTomorrow', { date: fmtMedium(tomorrow) })}</p>}
          </div>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('checkin.idSection')}</h3>
          {needsId ? (
            <>
              {idRequired && <p className="text-sm text-muted-foreground">{t('checkin.idRequired')}</p>}
              <IdFields idType={idType} idNumber={idNumber} onTypeChange={setIdType} onNumberChange={setIdNumber} error={idError} required={idRequired} />
            </>
          ) : (
            <p className="text-sm text-settled">{t('booking.idOnFile')}</p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('checkin.deposit')}</h3>
          <Field label={t('folio.amount')} hint={t('checkin.depositHint')}>
            <MoneyInput value={deposit} onChange={setDeposit} placeholder="0" />
          </Field>
          {depositValue > 0 && <PaymentMethodChips value={method} onChange={setMethod} />}
          {depositValue > 0 && b.folio && (
            <p className="text-sm text-muted-foreground">{t('new.afterDeposit', { amount: formatPKR(Math.max(b.folio.balance - depositValue, 0)) })}</p>
          )}
        </section>

        {error && (
          <p role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}
