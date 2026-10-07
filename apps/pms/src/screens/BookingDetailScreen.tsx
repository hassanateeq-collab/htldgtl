import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { PAYMENT_METHODS, formatPKR, t, type BookingStatus, type PaymentMethod } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useFolio } from '@/data/queries'
import { actionErrorLabel, useAddFolioItem, useSetBookingStatus } from '@/data/mutations'
import { fmtInstantShort, fmtShort, nightsBetween } from '@/lib/dates'
import { methodLabel, nightsLabel, sourceLabel } from '@/lib/labels'

const inputClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const OPERATOR_ROLES = ['owner', 'manager', 'front_desk']
const CASHIER_ROLES = ['owner', 'manager', 'front_desk', 'accounts']

export function BookingDetailScreen() {
  const { id } = useParams()
  const { property, role, access } = useTenant()
  const bookingsQ = useBookings(property.id)
  const folioQ = useFolio(id)
  const setStatus = useSetBookingStatus(property.id)
  const addItem = useAddFolioItem(property.id)

  const [folioMode, setFolioMode] = useState<'payment' | 'charge' | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  if (bookingsQ.isPending || folioQ.isPending) return <Loading />
  const loadError = bookingsQ.error ?? folioQ.error
  if (loadError) {
    return (
      <ErrorNote
        message={loadError.message}
        onRetry={() => {
          void bookingsQ.refetch()
          void folioQ.refetch()
        }}
      />
    )
  }

  const booking = (bookingsQ.data ?? []).find((b) => b.id === id)
  if (!booking) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">{t('booking.notFound')}</p>
      </div>
    )
  }

  const folio = folioQ.data ?? null
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const full = access?.accessLevel === 'full'
  const canOperate = full && !!role && OPERATOR_ROLES.includes(role)
  const canPost = full && !!role && CASHIER_ROLES.includes(role) && folio?.status === 'open'
  const balance = folio?.balance ?? 0

  async function changeStatus(status: BookingStatus) {
    if (!booking) return
    setActionError(null)
    try {
      await setStatus.mutateAsync({ bookingId: booking.id, status })
    } catch (err) {
      setActionError(actionErrorLabel(err))
    }
  }

  function resetFolioForm() {
    setFolioMode(null)
    setAmount('')
    setReference('')
    setDescription('')
    setMethod('cash')
  }

  async function saveFolioItem(e: FormEvent) {
    e.preventDefault()
    if (!folio || !folioMode || !booking) return
    const value = Number(amount)
    if (!(value > 0)) return
    setActionError(null)
    try {
      await addItem.mutateAsync({
        folioId: folio.id,
        bookingId: booking.id,
        kind: folioMode,
        amountPkr: value,
        method: folioMode === 'payment' ? method : null,
        reference: folioMode === 'payment' ? reference.trim() || null : null,
        description: folioMode === 'payment' ? 'Payment' : description.trim() || 'Charge',
      })
      resetFolioForm()
    } catch (err) {
      setActionError(actionErrorLabel(err))
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-24 md:max-w-5xl md:px-6 md:py-6 md:pb-8">
      <BackLink />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{booking.bookingNo}</p>
          <h2 className="text-xl font-semibold md:text-2xl">{booking.guest?.name ?? '—'}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 md:flex-row md:items-center md:gap-2">
          <StatusBadge status={booking.status} />
          <Badge className="border-border text-muted-foreground">{sourceLabel(booking.source)}</Badge>
        </div>
      </div>

      {canOperate && (booking.status === 'confirmed' || booking.status === 'checked_in') && (
        <div className="flex flex-wrap gap-2">
          {booking.status === 'confirmed' && (
            <>
              <Button onClick={() => void changeStatus('checked_in')} disabled={setStatus.isPending}>
                {setStatus.isPending ? t('actions.working') : t('actions.checkIn')}
              </Button>
              <ConfirmButton onConfirm={() => void changeStatus('no_show')} busy={setStatus.isPending}>
                {t('actions.noShow')}
              </ConfirmButton>
              <ConfirmButton onConfirm={() => void changeStatus('cancelled')} busy={setStatus.isPending}>
                {t('actions.cancel')}
              </ConfirmButton>
            </>
          )}
          {booking.status === 'checked_in' && (
            <ConfirmButton variant="default" onConfirm={() => void changeStatus('checked_out')} busy={setStatus.isPending}>
              {t('actions.checkOut')}
            </ConfirmButton>
          )}
        </div>
      )}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <div className="space-y-4">
          <Panel title={t('booking.guest')}>
            <Row label={t('booking.guest')} value={booking.guest?.name ?? '—'} />
            <Row label="Phone" value={booking.guest?.phone ?? '—'} />
            <Row label="Nationality" value={booking.guest?.nationality ?? '—'} />
          </Panel>

          <Panel title={t('booking.stay')}>
            <Row label={t('booking.room')} value={`${booking.roomLabel ?? '—'} · ${booking.roomTypeName ?? ''}`} />
            <Row label={t('booking.dates')} value={`${fmtShort(booking.checkIn)} → ${fmtShort(booking.checkOut)}`} />
            <Row label={t('booking.nights')} value={nightsLabel(nights)} />
            <Row label={t('booking.adults')} value={String(booking.adults)} />
            <Row label={t('booking.rate')} value={formatPKR(booking.nightlyRatePkr)} />
          </Panel>

          {booking.notes && (
            <Panel title={t('booking.notes')}>
              <p className="text-sm">{booking.notes}</p>
            </Panel>
          )}
        </div>

        <Panel title={folio?.status === 'closed' ? `${t('booking.folio')} · ${t('folio.closed')}` : t('booking.folio')}>
          {!folio || folio.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            folio.items.map((item) => (
              <Row
                key={item.id}
                label={
                  item.kind === 'payment'
                    ? `${methodLabel(item.method ?? 'cash')}${item.reference ? ` · ${item.reference}` : ''} · ${fmtInstantShort(item.postedAt)}`
                    : item.description
                }
                value={item.kind === 'payment' ? `− ${formatPKR(item.amountPkr)}` : formatPKR(item.amountPkr)}
              />
            ))
          )}
          <div className="my-2 border-t border-border" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">{balance > 0 ? t('booking.balance') : t('booking.settled')}</span>
            <span className={balance > 0 ? 'text-lg font-semibold' : 'text-lg font-semibold text-green-700'}>
              {formatPKR(Math.max(balance, 0))}
            </span>
          </div>

          {canPost && folioMode === null && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => setFolioMode('payment')}>
                {t('folio.addPayment')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFolioMode('charge')}>
                {t('folio.addCharge')}
              </Button>
            </div>
          )}

          {canPost && folioMode !== null && (
            <form onSubmit={saveFolioItem} className="mt-3 space-y-3 border-t border-border pt-3">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('folio.amount')}</span>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  required
                />
              </label>
              {folioMode === 'payment' ? (
                <>
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted-foreground">{t('folio.method')}</span>
                    <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {methodLabel(m)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted-foreground">{t('folio.reference')}</span>
                    <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} />
                  </label>
                </>
              ) : (
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">{t('folio.description')}</span>
                  <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} required />
                </label>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={addItem.isPending}>
                  {addItem.isPending ? t('actions.working') : t('folio.save')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={resetFolioForm}>
                  {t('folio.cancel')}
                </Button>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/bookings" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {t('common.back')}
    </Link>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
