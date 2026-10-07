import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Minus, Plus, UserCheck } from 'lucide-react'
import { BOOKING_SOURCES, formatPhone, formatPKR, isCnic, normalizePhone, t, tNights, type BookingSource, type PaymentMethod } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input, MoneyInput, Select, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/feedback'
import { ActionBar, Page, PageHeader } from '@/components/patterns/Page'
import { HkBadge } from '@/components/patterns/display'
import { IdFields, PaymentMethodChips } from '@/components/booking/fields'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useCreateBooking } from '@/data/bookings'
import { useGuest, useGuestLookup } from '@/data/guests'
import { sortByReadiness, useAvailability } from '@/data/availability'
import type { GuestVM, IdType } from '@/data/types'
import { addDaysStr, fmtMedium, isDateStr } from '@/lib/clock'
import { errorMessage } from '@/lib/errors'
import { sourceLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'

/**
 * New booking and walk-in check-in share one form. Walk-in (?walkin=1) adds the
 * ID section and the primary action becomes "Create and check in".
 */
export default function NewBookingScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { property } = useTenant()
  const today = useHotelToday()
  const create = useCreateBooking()

  const walkIn = params.get('walkin') === '1'
  const presetGuestQ = useGuest(params.get('guest') ?? undefined)
  const paramCheckIn = params.get('checkIn')
  const initialCheckIn = paramCheckIn && isDateStr(paramCheckIn) && paramCheckIn >= today ? paramCheckIn : today

  // guest
  const [lookup, setLookup] = useState('')
  const deferredLookup = useDeferredValue(lookup)
  const lookupQ = useGuestLookup(deferredLookup)
  const [guest, setGuest] = useState<GuestVM | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [nationality, setNationality] = useState('Pakistan')
  const [idType, setIdType] = useState<IdType>('cnic')
  const [idNumber, setIdNumber] = useState('')
  // stay
  const [checkIn, setCheckIn] = useState(initialCheckIn)
  const [nights, setNights] = useState(1)
  const [roomTypeId, setRoomTypeId] = useState<string>('')
  const [roomId, setRoomId] = useState<string>(params.get('room') ?? '')
  const [adults, setAdults] = useState('2')
  const [children, setChildren] = useState('0')
  const [source, setSource] = useState<BookingSource>(walkIn ? 'walk_in' : 'phone')
  const [rate, setRate] = useState('')
  const [notes, setNotes] = useState('')
  // money
  const [deposit, setDeposit] = useState('')
  const [method, setMethod] = useState<PaymentMethod | null>('cash')
  const [checkInNow, setCheckInNow] = useState(walkIn)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const checkOut = addDaysStr(checkIn, Math.max(nights, 1))
  const { rooms, roomTypes, pending: availPending } = useAvailability(checkIn, checkOut)

  const preselected = rooms.find((r) => r.id === roomId)
  const effectiveTypeId = roomTypeId || preselected?.roomTypeId || roomTypes[0]?.id || ''
  const selectedType = roomTypes.find((rt) => rt.id === effectiveTypeId)
  const typeRooms = useMemo(() => sortByReadiness(rooms.filter((r) => r.roomTypeId === effectiveTypeId)), [rooms, effectiveTypeId])
  const freeRooms = typeRooms.filter((r) => r.free)
  const chosen = typeRooms.find((r) => r.id === roomId)
  const chosenTaken = chosen ? !chosen.free : false

  // Never substitute silently: a taken room stays selected with a visible warning until the user picks another.
  useEffect(() => {
    if (!roomId && freeRooms[0]) setRoomId(freeRooms[0].id)
  }, [roomId, freeRooms])

  // Started from a guest's page: that guest is preselected.
  useEffect(() => {
    if (presetGuestQ.data && !guest) pickGuest(presetGuestQ.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetGuestQ.data])

  const rateValue = rate === '' ? (selectedType?.baseRatePkr ?? 0) : Number(rate) || 0
  const subtotal = nights * rateValue
  const taxOnRooms = property.taxMode === 'exclusive' ? Math.round(subtotal * property.taxRatePct) / 100 : 0
  const total = subtotal + taxOnRooms
  const depositValue = Number(deposit) || 0
  const canCheckInNow = checkIn === today

  function pickGuest(g: GuestVM) {
    setGuest(g)
    setLookup('')
    setGuestName(g.name)
    setGuestPhone(g.phone ?? '')
    if (g.nationality) setNationality(g.nationality)
  }
  function clearGuest() {
    setGuest(null)
    setGuestName('')
    setGuestPhone('')
    setIdNumber('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const errs: Record<string, string> = {}
    const name = guest?.name ?? guestName.trim()
    const phone = normalizePhone(guestPhone)
    if (!guest && name.length < 2) errs.name = t('new.nameRequired')
    if (!guest && guestPhone.trim() && (!phone || !/^\+[1-9]\d{6,14}$/.test(phone))) errs.phone = t('new.phoneInvalid')
    if (nights < 1) errs.dates = t('new.badDates')
    if (!roomId || chosenTaken) errs.room = chosenTaken ? t('new.roomTaken', { room: chosen?.label ?? '' }) : t('new.noRooms')
    const needsId = checkInNow && property.requireIdAtCheckIn && !(guest?.hasId ?? false)
    const idValue = idNumber.trim()
    if (needsId && !idValue) errs.id = t('new.idRequiredForCheckIn')
    if (idValue && idType === 'cnic' && !isCnic(idValue)) errs.id = t('guests.cnicFormat')
    if (depositValue > 0 && !method) errs.deposit = t('error.deposit_method')
    setFieldErrors(errs)
    if (Object.keys(errs).length) return

    try {
      const id = await create.mutateAsync({
        roomId,
        checkIn,
        checkOut,
        adults: Math.max(1, Number(adults) || 1),
        children: Math.max(0, Number(children) || 0),
        source,
        nightlyRate: rateValue,
        guestId: guest?.id ?? null,
        guestName: guest ? null : name,
        guestPhone: guest ? null : phone,
        guestIdType: idValue ? idType : null,
        guestIdNumber: idValue || null,
        guestNationality: guest ? null : nationality.trim() || null,
        notes: notes.trim() || null,
        deposit: depositValue,
        depositMethod: depositValue > 0 ? method : null,
        checkInNow,
      })
      toast.success(checkInNow ? t('checkin.success', { room: chosen?.label ?? '' }) : t('new.created'))
      navigate(`/bookings/${id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const title = walkIn ? t('new.walkInTitle') : t('new.title')

  return (
    <Page width="lg" withActionBar>
      <PageHeader title={title} back={-1} fallback="/bookings" />
      <form id="new-booking" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        {/* ---- guest ---- */}
        <Card>
          <CardHeader title={t('new.guest')} />
          <CardContent className="space-y-4">
            {guest ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-settled">
                    <UserCheck className="h-4 w-4" aria-hidden /> {t('new.returningGuest')}
                  </p>
                  <p className="truncate text-base font-medium">{guest.name}</p>
                  <p className="tnum text-sm text-muted-foreground">
                    {formatPhone(guest.phone)} · {guest.stays ? t('guests.stays', { n: guest.stays }) : t('guests.noStays')} · {guest.hasId ? t('guests.idOnFile') : t('guests.noId')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={clearGuest}>
                  {t('new.change')}
                </Button>
              </div>
            ) : (
              <>
                <Field label={t('new.guestPhone')} hint={t('new.searchHint')} error={fieldErrors.phone}>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    value={guestPhone}
                    onChange={(e) => {
                      setGuestPhone(e.target.value)
                      setLookup(e.target.value)
                    }}
                    placeholder="0300 1234567"
                    autoFocus
                  />
                </Field>
                <Field label={t('new.guestName')} required error={fieldErrors.name}>
                  <Input
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value)
                      setLookup(e.target.value)
                    }}
                    autoComplete="off"
                    autoCapitalize="words"
                  />
                </Field>
                {(lookupQ.data?.length ?? 0) > 0 && (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card" aria-label={t('new.returningGuest')}>
                    {lookupQ.data!.map((g) => (
                      <li key={g.id}>
                        <button type="button" onClick={() => pickGuest(g)} className="flex min-h-touch w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent active:bg-accent">
                          <span className="min-w-0">
                            <span className="block truncate text-base font-medium">{g.name}</span>
                            <span className="tnum block text-xs text-muted-foreground">
                              {formatPhone(g.phone)} · {g.stays ? t('guests.stays', { n: g.stays }) : t('guests.noStays')}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-primary">{t('new.returningGuest')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Field label={t('new.nationality')}>
                  <Input value={nationality} onChange={(e) => setNationality(e.target.value)} autoComplete="country-name" />
                </Field>
              </>
            )}
            {(!guest || !guest.hasId) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t('new.idType')} {checkInNow && property.requireIdAtCheckIn ? '' : <span className="font-normal text-muted-foreground">({t('common.optional')})</span>}
                </p>
                <IdFields idType={idType} idNumber={idNumber} onTypeChange={setIdType} onNumberChange={setIdNumber} error={fieldErrors.id} required={checkInNow && property.requireIdAtCheckIn} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- stay ---- */}
        <Card className="md:row-span-2">
          <CardHeader title={t('new.stay')} />
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('new.checkIn')} error={fieldErrors.dates}>
                <Input type="date" value={checkIn} min={today} onChange={(e) => isDateStr(e.target.value) && setCheckIn(e.target.value)} />
              </Field>
              <Field label={t('new.nights')}>
                <div className="flex h-touch items-center rounded-md border border-input bg-card">
                  <Button type="button" variant="ghost" size="icon" aria-label="−" onClick={() => setNights((n) => Math.max(1, n - 1))} className="h-full rounded-r-none">
                    <Minus className="h-5 w-5" aria-hidden />
                  </Button>
                  <span className="tnum flex-1 text-center text-base font-medium">{tNights(nights)}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="+" onClick={() => setNights((n) => Math.min(60, n + 1))} className="h-full rounded-l-none">
                    <Plus className="h-5 w-5" aria-hidden />
                  </Button>
                </div>
              </Field>
            </div>
            <p className="tnum text-sm text-muted-foreground">
              {t('new.checkOut')}: <span className="font-medium text-foreground">{fmtMedium(checkOut)}</span>
            </p>

            <Field label={t('new.roomType')}>
              <Select
                value={effectiveTypeId}
                onChange={(e) => {
                  setRoomTypeId(e.target.value)
                  setRoomId('')
                  setRate('')
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
              {availPending ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : typeRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('new.noRooms')}</p>
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
              {fieldErrors.room && (
                <p role="alert" className="text-sm font-medium text-due">
                  {fieldErrors.room}
                </p>
              )}
              {chosen && chosen.free && chosen.housekeepingStatus === 'dirty' && <p className="text-sm text-warning">{t('new.roomDirty', { room: chosen.label })}</p>}
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

            <Field label={t('new.rate')} hint={selectedType ? `${selectedType.name}: ${formatPKR(selectedType.baseRatePkr)}` : undefined}>
              <MoneyInput value={rate} onChange={setRate} placeholder={String(selectedType?.baseRatePkr ?? 0)} />
            </Field>

            <Field label={t('new.notes')}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>
          </CardContent>
        </Card>

        {/* ---- payment ---- */}
        <Card>
          <CardHeader title={t('new.deposit')} />
          <CardContent className="space-y-3">
            <Field label={t('new.depositAmount')} error={fieldErrors.deposit}>
              <MoneyInput value={deposit} onChange={setDeposit} placeholder="0" />
            </Field>
            {depositValue > 0 && <PaymentMethodChips value={method} onChange={setMethod} />}
            {canCheckInNow && (
              <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border border-border px-3">
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={checkInNow} onChange={(e) => setCheckInNow(e.target.checked)} />
                <span className="text-base font-medium">{t('actions.checkIn')} {t('common.today').toLowerCase()}</span>
              </label>
            )}
          </CardContent>
        </Card>
      </form>

      <ActionBar>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="tnum text-sm text-muted-foreground">
            {t('new.summary', { nights, rate: formatPKR(rateValue) })}
            {taxOnRooms > 0 && ` · ${t('new.tax', { tax: formatPKR(taxOnRooms) })}`}
          </span>
          <span className="tnum text-base font-semibold">
            {t('new.total', { total: formatPKR(total) })}
            {depositValue > 0 && <span className="ml-2 font-normal text-due">{t('new.afterDeposit', { amount: formatPKR(Math.max(total - depositValue, 0)) })}</span>}
          </span>
          {error && (
            <span role="alert" className="text-sm font-medium text-due">
              {error}
            </span>
          )}
        </div>
        <Button type="submit" form="new-booking" size="lg" loading={create.isPending} disabled={availPending || !roomId}>
          {checkInNow ? t('new.createAndCheckIn') : t('new.create')}
        </Button>
      </ActionBar>
    </Page>
  )
}
