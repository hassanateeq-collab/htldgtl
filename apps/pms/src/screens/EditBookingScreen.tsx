import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BOOKING_SOURCES, formatPKR, t, tNights, type BookingSource } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input, MoneyInput, Select, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState, Skeleton, toast } from '@/components/ui/feedback'
import { ActionBar, Page, PageHeader } from '@/components/patterns/Page'
import { HkBadge } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useHotelToday } from '@/data/tenant'
import { useBooking, useUpdateBooking } from '@/data/bookings'
import { sortByReadiness, useAvailability } from '@/data/availability'
import type { BookingVM } from '@/data/types'
import { addDaysStr, isDateStr, nightsBetween } from '@/lib/clock'
import { errorMessage } from '@/lib/errors'
import { sourceLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'

export default function EditBookingScreen() {
  const { id } = useParams()
  const bookingQ = useBooking(id)
  const b = bookingQ.data ?? null
  const editable = b ? b.status === 'confirmed' || b.status === 'checked_in' : false

  return (
    <Page width="md" withActionBar>
      <PageHeader title={t('edit.title')} subtitle={b ? `${b.bookingNo} · ${b.guest.name}` : undefined} back={b ? `/bookings/${b.id}` : '/bookings'} />
      <QueryState pending={bookingQ.isPending} error={bookingQ.error} skeleton={<Skeleton className="h-96" />}>
        {!b ? <EmptyState title={t('booking.notFound')} /> : !editable ? <EmptyState title={t('edit.closed')} /> : <EditForm key={b.id} booking={b} />}
      </QueryState>
    </Page>
  )
}

/** Mounted with key=booking.id so the form state seeds once from the booking. */
function EditForm({ booking: b }: { booking: BookingVM }) {
  const navigate = useNavigate()
  const today = useHotelToday()
  const update = useUpdateBooking()
  const inHouse = b.status === 'checked_in'

  const [checkIn, setCheckIn] = useState(b.checkIn)
  const [checkOut, setCheckOut] = useState(b.checkOut)
  const [roomTypeId, setRoomTypeId] = useState(b.room?.typeId ?? '')
  const [roomId, setRoomId] = useState(b.room?.id ?? '')
  const [adults, setAdults] = useState(String(b.adults))
  const [children, setChildren] = useState(String(b.children))
  const [source, setSource] = useState<BookingSource>(b.source)
  const [rate, setRate] = useState(String(b.nightlyRatePkr))
  const [notes, setNotes] = useState(b.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  const { rooms, roomTypes, pending } = useAvailability(checkIn, checkOut > checkIn ? checkOut : addDaysStr(checkIn, 1), b.id)
  const typeRooms = useMemo(() => sortByReadiness(rooms.filter((r) => r.roomTypeId === roomTypeId)), [rooms, roomTypeId])
  const chosen = typeRooms.find((r) => r.id === roomId)
  const chosenTaken = chosen ? !chosen.free : false
  const rateValue = Number(rate) || 0
  const changed = checkIn !== b.checkIn || checkOut !== b.checkOut || roomId !== b.room?.id || rateValue !== b.nightlyRatePkr

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (nights < 1) return setError(t('new.badDates'))
    if (!roomId || chosenTaken) return setError(chosenTaken ? t('new.roomTaken', { room: chosen?.label ?? '' }) : t('new.noRooms'))
    try {
      await update.mutateAsync({
        bookingId: b.id,
        roomId,
        checkIn,
        checkOut,
        adults: Math.max(1, Number(adults) || 1),
        children: Math.max(0, Number(children) || 0),
        source,
        nightlyRate: rateValue,
        notes: notes.trim() || null,
      })
      toast.success(t('edit.saved'))
      navigate(`/bookings/${b.id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <form id="edit-booking" onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader title={t('new.stay')} />
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('new.checkIn')} hint={inHouse ? t('edit.checkInLocked') : undefined}>
                <Input type="date" value={checkIn} disabled={inHouse} onChange={(e) => isDateStr(e.target.value) && setCheckIn(e.target.value)} />
              </Field>
              <Field label={t('new.checkOut')}>
                <Input type="date" value={checkOut} min={inHouse ? addDaysStr(today, 1) : addDaysStr(checkIn, 1)} onChange={(e) => isDateStr(e.target.value) && setCheckOut(e.target.value)} />
              </Field>
            </div>
            <p className="tnum text-sm text-muted-foreground">{nights >= 1 ? tNights(nights) : t('new.badDates')}</p>

            <Field label={t('new.roomType')}>
              <Select
                value={roomTypeId}
                onChange={(e) => {
                  setRoomTypeId(e.target.value)
                  setRoomId('')
                }}
              >
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} · {formatPKR(rt.baseRatePkr)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('new.room')}</p>
              {pending ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('new.room')}>
                  {typeRooms.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={roomId === r.id}
                      disabled={!r.free && roomId !== r.id}
                      onClick={() => setRoomId(r.id)}
                      className={cn(
                        'flex min-h-touch flex-col items-start justify-center rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40',
                        roomId === r.id ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-accent/60',
                        roomId === r.id && !r.free && 'border-due bg-due-bg',
                      )}
                    >
                      <span className="tnum text-base font-semibold">{r.label}</span>
                      <HkBadge status={r.housekeepingStatus} className="mt-1" />
                    </button>
                  ))}
                </div>
              )}
              {chosenTaken && (
                <p role="alert" className="text-sm font-medium text-due">
                  {t('new.roomTaken', { room: chosen?.label ?? '' })}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('new.adults')}>
                <Input type="number" inputMode="numeric" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} />
              </Field>
              <Field label={t('new.children')}>
                <Input type="number" inputMode="numeric" min={0} value={children} onChange={(e) => setChildren(e.target.value)} />
              </Field>
            </div>
            <Field label={t('new.source')}>
              <Segmented ariaLabel={t('new.source')} value={source} onChange={setSource} wrap options={BOOKING_SOURCES.map((s) => ({ value: s, label: sourceLabel(s) }))} />
            </Field>
            <Field label={t('new.rate')}>
              <MoneyInput value={rate} onChange={setRate} />
            </Field>
            {changed && nights >= 1 && <p className="text-sm text-muted-foreground">{t('edit.repost', { nights, rate: formatPKR(rateValue) })}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('new.notes')} />
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </CardContent>
        </Card>
        {error && (
          <p role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </form>
      <ActionBar>
        <Button variant="outline" size="lg" onClick={() => navigate(`/bookings/${b.id}`)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="edit-booking" size="lg" className="flex-1" loading={update.isPending} disabled={pending || chosenTaken}>
          {t('edit.save')}
        </Button>
      </ActionBar>
    </>
  )
}
