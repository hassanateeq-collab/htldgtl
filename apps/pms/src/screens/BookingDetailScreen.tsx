import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Pencil, Printer, User } from 'lucide-react'
import { PAYMENT_METHODS, formatPKR, t, type BookingStatus, type MessageKey, type PaymentMethod } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useFolio } from '@/data/queries'
import { actionErrorLabel, useAddFolioItem, useSetBookingStatus } from '@/data/mutations'
import type { FolioItemKind, FolioItemVM } from '@/data/types'
import { fmtInstantShort, fmtShort, nightsBetween } from '@/lib/dates'
import { methodLabel, nightsLabel, sourceLabel } from '@/lib/labels'

const inputClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const OPERATOR_ROLES = ['owner', 'manager', 'front_desk']
const CASHIER_ROLES = ['owner', 'manager', 'front_desk', 'accounts']
const KINDS: FolioItemKind[] = ['payment', 'charge', 'discount', 'refund']
const kindLabel = (k: FolioItemKind) => t(`kind.${k}` as MessageKey)
const needsMethod = (k: FolioItemKind) => k === 'payment' || k === 'refund'

function itemLabel(item: FolioItemVM): string {
  if (needsMethod(item.kind)) {
    // "Advance payment · Cash · 07 Oct" — a specific description wins over the generic kind name.
    const head = item.description && item.description !== kindLabel(item.kind) ? item.description : kindLabel(item.kind)
    const base = `${head} · ${methodLabel(item.method ?? 'cash')}`
    return `${base}${item.reference ? ` · ${item.reference}` : ''} · ${fmtInstantShort(item.postedAt)}`
  }
  if (item.kind === 'discount') return `${kindLabel('discount')} · ${item.description}`
  return item.description
}

function itemValue(item: FolioItemVM): string {
  const negative = item.kind === 'payment' || item.kind === 'discount'
  return `${negative ? '− ' : item.kind === 'refund' ? '+ ' : ''}${formatPKR(item.amountPkr)}`
}

export function BookingDetailScreen() {
  const { id } = useParams()
  const { property, role, access } = useTenant()
  const bookingsQ = useBookings(property.id)
  const folioQ = useFolio(id)
  const setStatus = useSetBookingStatus(property.id)
  const addItem = useAddFolioItem(property.id)

  const [posting, setPosting] = useState(false)
  const [kind, setKind] = useState<FolioItemKind>('payment')
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
  const editable = canOperate && (booking.status === 'confirmed' || booking.status === 'checked_in')
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

  function resetForm() {
    setPosting(false)
    setKind('payment')
    setAmount('')
    setReference('')
    setDescription('')
    setMethod('cash')
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault()
    if (!folio || !booking) return
    const value = Number(amount)
    if (!(value > 0)) return
    setActionError(null)
    try {
      await addItem.mutateAsync({
        folioId: folio.id,
        bookingId: booking.id,
        kind,
        amountPkr: value,
        method: needsMethod(kind) ? method : null,
        reference: needsMethod(kind) ? reference.trim() || null : null,
        description: needsMethod(kind) ? kindLabel(kind) : description.trim() || kindLabel(kind),
      })
      resetForm()
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

      <div className="flex flex-wrap gap-2">
        {editable && booking.status === 'confirmed' && (
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
        {editable && booking.status === 'checked_in' && (
          <ConfirmButton variant="default" onConfirm={() => void changeStatus('checked_out')} busy={setStatus.isPending}>
            {t('actions.checkOut')}
          </ConfirmButton>
        )}
        {editable && (
          <Link to={`/bookings/${booking.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
            <Pencil className="h-4 w-4" aria-hidden />
            {t('booking.edit')}
          </Link>
        )}
        {folio && (
          <Link to={`/bookings/${booking.id}/receipt`} className={buttonVariants({ variant: 'outline' })}>
            <Printer className="h-4 w-4" aria-hidden />
            {t('booking.receipt')}
          </Link>
        )}
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <div className="space-y-4">
          <Panel title={t('booking.guest')}>
            <Row label={t('booking.guest')} value={booking.guest?.name ?? '—'} />
            <Row label={t('guests.phone')} value={booking.guest?.phone ?? '—'} />
            <Row label={t('guests.nationality')} value={booking.guest?.nationality ?? '—'} />
            {booking.guest && (
              <Link
                to={`/guests/${booking.guest.id}`}
                className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground underline"
              >
                <User className="h-4 w-4" aria-hidden />
                {t('booking.viewGuest')}
              </Link>
            )}
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
            folio.items.map((item) => <Row key={item.id} label={itemLabel(item)} value={itemValue(item)} />)
          )}
          <div className="my-2 border-t border-border" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">{balance > 0 ? t('booking.balance') : t('booking.settled')}</span>
            <span className={balance > 0 ? 'text-lg font-semibold' : 'text-lg font-semibold text-green-700'}>
              {formatPKR(Math.max(balance, 0))}
            </span>
          </div>

          {canPost && !posting && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setKind('payment')
                  setPosting(true)
                }}
              >
                {t('folio.addPayment')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setKind('charge')
                  setPosting(true)
                }}
              >
                {t('folio.add')}
              </Button>
            </div>
          )}

          {canPost && posting && (
            <form onSubmit={saveItem} className="mt-3 space-y-3 border-t border-border pt-3">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('folio.kind')}</span>
                <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as FolioItemKind)}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {kindLabel(k)}
                    </option>
                  ))}
                </select>
              </label>
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
              {needsMethod(kind) ? (
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
                <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
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
