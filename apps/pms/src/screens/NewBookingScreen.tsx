import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import {
  BOOKING_SOURCES,
  PAYMENT_METHODS,
  formatPKR,
  t,
  toPakistanE164,
  type BookingSource,
  type PaymentMethod,
} from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/Panel'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useRooms, useRoomTypes } from '@/data/queries'
import { actionErrorLabel, useCreateBooking } from '@/data/mutations'
import { OCCUPYING_STATUSES } from '@/data/types'
import { addDaysStr, nightsBetween, todayStr } from '@/lib/dates'
import { methodLabel, sourceLabel } from '@/lib/labels'
import { supabase } from '@/lib/supabase'

const inputClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

interface GuestHit {
  id: string
  name: string
  phone: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function NewBookingScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { property } = useTenant()
  const roomTypesQ = useRoomTypes(property.id)
  const roomsQ = useRooms(property.id)
  const bookingsQ = useBookings(property.id)
  const create = useCreateBooking(property.id)

  const today = todayStr()
  const paramCheckIn = params.get('checkIn')
  const initialCheckIn = paramCheckIn && DATE_RE.test(paramCheckIn) ? paramCheckIn : today

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<GuestHit | null>(null)
  const [checkIn, setCheckIn] = useState(initialCheckIn)
  const [checkOut, setCheckOut] = useState(addDaysStr(initialCheckIn, 1))
  const [roomTypeId, setRoomTypeId] = useState('')
  const [roomId, setRoomId] = useState(params.get('room') ?? '')
  const [adults, setAdults] = useState(2)
  const [source, setSource] = useState<BookingSource>('walk_in')
  const [rate, setRate] = useState('')
  const [notes, setNotes] = useState('')
  const [deposit, setDeposit] = useState('')
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('cash')
  const [formError, setFormError] = useState<string | null>(null)

  const term = guestName.trim()
  const guestSearch = useQuery({
    queryKey: ['guest-search', term],
    enabled: !selectedGuest && term.length >= 2,
    queryFn: async (): Promise<GuestHit[]> => {
      const { data, error } = await supabase
        .from('guests')
        .select('id, name, phone')
        .ilike('name', `%${term}%`)
        .order('name')
        .limit(5)
      if (error) throw error
      return (data ?? []) as GuestHit[]
    },
  })

  const roomTypes = roomTypesQ.data ?? []
  const rooms = roomsQ.data ?? []
  const bookings = bookingsQ.data ?? []
  const preselectedRoom = rooms.find((r) => r.id === roomId)
  const effectiveTypeId = roomTypeId || preselectedRoom?.roomTypeId || roomTypes[0]?.id || ''
  const selectedType = roomTypes.find((rt) => rt.id === effectiveTypeId)
  const nights = nightsBetween(checkIn, checkOut)

  // Rooms of the chosen type with no blocking stay overlapping the requested
  // nights — the same rule as the database's EXCLUDE constraint, which remains
  // the race-safe guard.
  const freeRooms = useMemo(() => {
    const busy = new Set(
      bookings
        .filter((b) => OCCUPYING_STATUSES.has(b.status) && b.roomId && b.checkIn < checkOut && checkIn < b.checkOut)
        .map((b) => b.roomId),
    )
    return rooms.filter((r) => r.roomTypeId === effectiveTypeId && r.isActive && !busy.has(r.id))
  }, [bookings, rooms, effectiveTypeId, checkIn, checkOut])

  const effectiveRoomId = freeRooms.some((r) => r.id === roomId) ? roomId : (freeRooms[0]?.id ?? '')
  const effectiveRate = rate === '' ? (selectedType?.baseRatePkr ?? 0) : Number(rate)
  const depositValue = Number(deposit) || 0

  if (roomTypesQ.isPending || roomsQ.isPending || bookingsQ.isPending) return <Loading />
  const loadError = roomTypesQ.error ?? roomsQ.error ?? bookingsQ.error
  if (loadError) return <ErrorNote message={loadError.message} />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!selectedGuest && guestName.trim().length < 2) return setFormError(t('new.nameRequired'))
    if (nights < 1) return setFormError(t('new.badDates'))
    if (!effectiveRoomId) return setFormError(t('new.noRooms'))

    const rawPhone = guestPhone.trim()
    try {
      const id = await create.mutateAsync({
        propertyId: property.id,
        roomId: effectiveRoomId,
        checkIn,
        checkOut,
        adults,
        source,
        nightlyRate: effectiveRate,
        guestId: selectedGuest?.id ?? null,
        guestName: selectedGuest ? null : guestName.trim(),
        guestPhone: selectedGuest ? null : rawPhone ? (toPakistanE164(rawPhone) ?? rawPhone) : null,
        notes: notes.trim() || null,
        deposit: depositValue > 0 ? depositValue : 0,
        depositMethod: depositValue > 0 ? depositMethod : null,
      })
      navigate(`/bookings/${id}`, { replace: true })
    } catch (err) {
      setFormError(actionErrorLabel(err))
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-24 md:max-w-5xl md:px-6 md:py-6 md:pb-8">
      <Link to="/bookings" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {t('common.back')}
      </Link>
      <h2 className="text-xl font-semibold md:text-2xl">{t('new.title')}</h2>

      {/* Mobile order: guest → stay → advance payment → notes (the deposit depends on the total).
          Desktop: guest / payment / notes stack in the left column, stay spans the right. */}
      <form onSubmit={onSubmit} className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <div className="md:col-start-1">
          <Panel title={t('new.guest')}>
            {selectedGuest ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{t('new.usingGuest', { name: selectedGuest.name })}</span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => {
                    setSelectedGuest(null)
                    setGuestName('')
                    setGuestPhone('')
                  }}
                >
                  {t('new.change')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">{t('new.guestName')}</span>
                  <input
                    className={inputClass}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t('new.searchHint')}
                    autoComplete="off"
                    autoFocus
                  />
                </label>
                {(guestSearch.data?.length ?? 0) > 0 && (
                  <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                    {guestSearch.data!.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm active:bg-accent"
                          onClick={() => {
                            setSelectedGuest(g)
                            setGuestName(g.name)
                            setGuestPhone(g.phone ?? '')
                          }}
                        >
                          <span>{g.name}</span>
                          <span className="text-xs text-muted-foreground">{g.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">{t('new.guestPhone')}</span>
                  <input
                    className={inputClass}
                    type="tel"
                    inputMode="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="0300 1234567"
                  />
                </label>
              </div>
            )}
          </Panel>
        </div>

        <Panel title={t('new.stay')} className="md:col-start-2 md:row-start-1 md:row-span-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">{t('new.checkIn')}</span>
              <input className={inputClass} type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">{t('new.checkOut')}</span>
              <input className={inputClass} type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">{t('new.roomType')}</span>
              <select
                className={inputClass}
                value={effectiveTypeId}
                onChange={(e) => {
                  setRoomTypeId(e.target.value)
                  setRoomId('')
                  setRate('')
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
                value={effectiveRoomId}
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
                value={adults}
                onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">{t('new.source')}</span>
              <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value as BookingSource)}>
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
                value={rate}
                placeholder={String(selectedType?.baseRatePkr ?? '')}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
          </div>
          {freeRooms.length === 0 && <p className="mt-3 text-sm text-destructive">{t('new.noRooms')}</p>}
          {nights >= 1 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('new.total', {
                nights: nights,
                rate: formatPKR(effectiveRate),
                total: formatPKR(nights * effectiveRate),
              })}
              {depositValue > 0 ? ` · ${t('bookings.due', { amount: formatPKR(Math.max(nights * effectiveRate - depositValue, 0)) })}` : ''}
            </p>
          )}
        </Panel>

        <div className="md:col-start-1">
          <Panel title={t('new.deposit')}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.depositAmount')}</span>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('new.depositMethod')}</span>
                <select
                  className={inputClass}
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                  disabled={depositValue <= 0}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {methodLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>
        </div>

        <div className="md:col-start-1">
          <Panel title={t('new.notes')}>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Panel>
        </div>

        <div className="space-y-3 md:col-span-2">
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="lg" className="w-full md:w-auto md:px-8" disabled={create.isPending || freeRooms.length === 0}>
            {create.isPending ? t('new.creating') : t('new.create')}
          </Button>
        </div>
      </form>
    </div>
  )
}
