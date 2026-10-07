import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { BOOKING_SOURCES, formatPKR, t, type BookingSource } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/Panel'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useRooms, useRoomTypes } from '@/data/queries'
import { actionErrorLabel, useUpdateBooking } from '@/data/mutations'
import { OCCUPYING_STATUSES } from '@/data/types'
import { nightsBetween } from '@/lib/dates'
import { sourceLabel } from '@/lib/labels'

const inputClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

export function EditBookingScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { property } = useTenant()
  const roomTypesQ = useRoomTypes(property.id)
  const roomsQ = useRooms(property.id)
  const bookingsQ = useBookings(property.id)
  const update = useUpdateBooking(property.id)

  const booking = (bookingsQ.data ?? []).find((b) => b.id === id)

  // Form state seeded from the booking once loaded (key on booking id below).
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [adults, setAdults] = useState<number | null>(null)
  const [source, setSource] = useState<BookingSource | null>(null)
  const [rate, setRate] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const rooms = roomsQ.data ?? []
  const roomTypes = roomTypesQ.data ?? []
  const bookings = bookingsQ.data ?? []

  const vCheckIn = checkIn ?? booking?.checkIn ?? ''
  const vCheckOut = checkOut ?? booking?.checkOut ?? ''
  const vTypeId = roomTypeId ?? booking?.roomTypeId ?? roomTypes[0]?.id ?? ''
  const vAdults = adults ?? booking?.adults ?? 1
  const vSource = source ?? booking?.source ?? 'walk_in'
  const vRate = rate ?? (booking ? String(booking.nightlyRatePkr) : '')
  const vNotes = notes ?? booking?.notes ?? ''
  const nights = vCheckIn && vCheckOut ? nightsBetween(vCheckIn, vCheckOut) : 0

  // Free rooms of the chosen type for the new dates, ignoring this booking's own stay.
  const freeRooms = useMemo(() => {
    const busy = new Set(
      bookings
        .filter(
          (b) =>
            b.id !== id &&
            OCCUPYING_STATUSES.has(b.status) &&
            b.roomId &&
            b.checkIn < vCheckOut &&
            vCheckIn < b.checkOut,
        )
        .map((b) => b.roomId),
    )
    return rooms.filter((r) => r.roomTypeId === vTypeId && r.isActive && !busy.has(r.id))
  }, [bookings, rooms, vTypeId, vCheckIn, vCheckOut, id])

  const desiredRoomId = roomId ?? booking?.roomId ?? ''
  const vRoomId = freeRooms.some((r) => r.id === desiredRoomId) ? desiredRoomId : (freeRooms[0]?.id ?? '')

  if (roomTypesQ.isPending || roomsQ.isPending || bookingsQ.isPending) return <Loading />
  const loadError = roomTypesQ.error ?? roomsQ.error ?? bookingsQ.error
  if (loadError) return <ErrorNote message={loadError.message} />
  if (!booking) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <BackLink id={id} />
        <p className="text-sm text-muted-foreground">{t('booking.notFound')}</p>
      </div>
    )
  }

  const editable = booking.status === 'confirmed' || booking.status === 'checked_in'
  const checkInLocked = booking.status === 'checked_in'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!booking) return
    setFormError(null)
    if (nights < 1) return setFormError(t('new.badDates'))
    if (!vRoomId) return setFormError(t('new.noRooms'))
    try {
      await update.mutateAsync({
        bookingId: booking.id,
        roomId: vRoomId,
        checkIn: vCheckIn,
        checkOut: vCheckOut,
        adults: vAdults,
        source: vSource,
        nightlyRate: Number(vRate) || 0,
        notes: vNotes.trim() || null,
      })
      navigate(`/bookings/${booking.id}`, { replace: true })
    } catch (err) {
      setFormError(actionErrorLabel(err))
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-24 md:max-w-3xl md:px-6 md:py-6 md:pb-8">
      <BackLink id={booking.id} />
      <div>
        <p className="text-xs text-muted-foreground">{booking.bookingNo}</p>
        <h2 className="text-xl font-semibold md:text-2xl">
          {t('edit.title')} · {booking.guest?.name ?? '—'}
        </h2>
      </div>

      {!editable ? (
        <p className="text-sm text-destructive">{t('error.bad_transition')}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Panel title={t('new.stay')}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.checkIn')}</span>
                <input
                  className={inputClass}
                  type="date"
                  value={vCheckIn}
                  disabled={checkInLocked}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.checkOut')}</span>
                <input className={inputClass} type="date" value={vCheckOut} onChange={(e) => setCheckOut(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.roomType')}</span>
                <select
                  className={inputClass}
                  value={vTypeId}
                  onChange={(e) => {
                    setRoomTypeId(e.target.value)
                    setRoomId('')
                  }}
                >
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.room')}</span>
                <select
                  className={inputClass}
                  value={vRoomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  disabled={freeRooms.length === 0}
                >
                  {freeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.adults')}</span>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={vAdults}
                  onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.source')}</span>
                <select className={inputClass} value={vSource} onChange={(e) => setSource(e.target.value as BookingSource)}>
                  {BOOKING_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {sourceLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.rate')}</span>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={vRate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </label>
            </div>
            {checkInLocked && <p className="mt-3 text-xs text-muted-foreground">{t('edit.checkInLocked')}</p>}
            {freeRooms.length === 0 && <p className="mt-3 text-sm text-destructive">{t('new.noRooms')}</p>}
            {nights >= 1 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('new.total', {
                  nights: nights,
                  rate: formatPKR(Number(vRate) || 0),
                  total: formatPKR(nights * (Number(vRate) || 0)),
                })}
              </p>
            )}
          </Panel>

          <Panel title={t('new.notes')}>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={vNotes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Panel>

          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="lg" className="w-full md:w-auto md:px-8" disabled={update.isPending || freeRooms.length === 0}>
            {update.isPending ? t('edit.saving') : t('edit.save')}
          </Button>
        </form>
      )}
    </div>
  )
}

function BackLink({ id }: { id: string | undefined }) {
  return (
    <Link to={id ? `/bookings/${id}` : '/bookings'} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {t('common.back')}
    </Link>
  )
}
