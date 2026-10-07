import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, ClipboardList, Eye, EyeOff, FileText, LogIn, LogOut, MoreHorizontal, MoveRight, Pencil, Phone, Printer, RotateCcw, Undo2, User, Wallet } from 'lucide-react'
import { formatPhone, formatPKR, t, tNights, type MessageKey } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, DefinitionList, DefinitionRow } from '@/components/ui/card'
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu'
import { EmptyState, Skeleton, toast } from '@/components/ui/feedback'
import { ActionBar, Page, PageHeader } from '@/components/patterns/Page'
import { BalanceText, DateRange, HkBadge, Money, StatusBadge } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { ReasonSheet } from '@/components/patterns/ReasonSheet'
import { CheckInSheet } from '@/components/booking/CheckInSheet'
import { CheckOutSheet } from '@/components/booking/CheckOutSheet'
import { PostItemSheet } from '@/components/booking/PostItemSheet'
import { MoveRoomSheet } from '@/components/booking/MoveRoomSheet'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useBooking, useSetBookingStatus } from '@/data/bookings'
import { useCloseFolio, useFolio, useReopenFolio, useVoidFolioItem } from '@/data/folio'
import { useStaffNames } from '@/data/settings'
import type { BookingVM, FolioItemVM, FolioVM } from '@/data/types'
import { addDaysStr, fmtInstant, fmtShort } from '@/lib/clock'
import { errorMessage } from '@/lib/errors'
import { categoryLabel, kindLabel, methodLabel, sourceLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'

type SheetKind = 'checkin' | 'checkout' | 'payment' | 'charge' | 'move' | 'cancel' | 'noshow' | 'reopen' | null

export default function BookingDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can, property } = useTenant()
  const today = useHotelToday()
  const bookingQ = useBooking(id)
  const folioQ = useFolio(id)
  const setStatus = useSetBookingStatus()
  const reopen = useReopenFolio()
  const close = useCloseFolio()
  const voidItem = useVoidFolioItem()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [voidTarget, setVoidTarget] = useState<FolioItemVM | null>(null)
  const [showVoided, setShowVoided] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)

  const b = bookingQ.data ?? null
  const folio = folioQ.data ?? null

  const canTransition = can('bookings.transition')
  const canCorrect = can('bookings.correct')
  const canPost = can('folio.post') && folio?.status === 'open'
  const canVoid = can('folio.void')
  const canReopen = can('folio.reopen')

  async function transition(status: 'cancelled' | 'no_show' | 'confirmed', reason?: string, successKey?: MessageKey) {
    if (!b) return
    setSheetError(null)
    try {
      await setStatus.mutateAsync({ bookingId: b.id, status, reason })
      if (successKey) toast.success(t(successKey))
      setSheet(null)
    } catch (e) {
      setSheetError(errorMessage(e))
      if (!sheet) toast.error(errorMessage(e))
    }
  }

  async function doVoid(reason: string) {
    if (!b || !voidTarget) return
    setSheetError(null)
    try {
      await voidItem.mutateAsync({ bookingId: b.id, itemId: voidTarget.id, reason })
      toast.success(t('toast.voided'))
      setVoidTarget(null)
    } catch (e) {
      setSheetError(errorMessage(e))
    }
  }

  async function doReopen(reason: string) {
    if (!b || !folio) return
    setSheetError(null)
    try {
      await reopen.mutateAsync({ bookingId: b.id, folioId: folio.id, reason })
      toast.success(t('toast.folioReopened'))
      setSheet(null)
    } catch (e) {
      setSheetError(errorMessage(e))
    }
  }

  async function doClose() {
    if (!b || !folio) return
    try {
      await close.mutateAsync({ bookingId: b.id, folioId: folio.id })
      toast.success(t('toast.folioClosed'))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const headerActions = b ? (
    <Menu
      trigger={
        <Button variant="ghost" size="icon" aria-label={t('actions.more')}>
          <MoreHorizontal className="h-6 w-6" aria-hidden />
        </Button>
      }
    >
      {can('bookings.edit') && (b.status === 'confirmed' || b.status === 'checked_in') && (
        <>
          <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => navigate(`/bookings/${b.id}/edit`)}>
            {t('actions.edit')}
          </MenuItem>
          <MenuItem icon={<MoveRight className="h-4 w-4" />} onSelect={() => setSheet('move')}>
            {t('actions.moveRoom')}
          </MenuItem>
        </>
      )}
      <MenuItem icon={<Printer className="h-4 w-4" />} onSelect={() => navigate(`/bookings/${b.id}/receipt`)}>
        {folio?.status === 'closed' ? t('actions.receipt') : t('actions.statement')}
      </MenuItem>
      <MenuItem icon={<FileText className="h-4 w-4" />} onSelect={() => navigate(`/bookings/${b.id}/registration`)}>
        {t('actions.registration')}
      </MenuItem>
      <MenuItem icon={<User className="h-4 w-4" />} onSelect={() => navigate(`/guests/${b.guest.id}`)}>
        {t('booking.viewGuest')}
      </MenuItem>
      {canCorrect && b.status === 'checked_in' && (
        <MenuItem icon={<Undo2 className="h-4 w-4" />} onSelect={() => void transition('confirmed', undefined, 'toast.undoCheckIn')}>
          {t('actions.undoCheckIn')}
        </MenuItem>
      )}
      {canCorrect && (b.status === 'cancelled' || b.status === 'no_show') && (
        <MenuItem icon={<RotateCcw className="h-4 w-4" />} onSelect={() => void transition('confirmed', undefined, 'toast.reinstated')}>
          {t('actions.reinstate')}
        </MenuItem>
      )}
      {canTransition && b.status === 'confirmed' && (
        <>
          <MenuSeparator />
          <MenuItem icon={<Ban className="h-4 w-4" />} onSelect={() => setSheet('noshow')}>
            {t('actions.noShow')}
          </MenuItem>
          <MenuItem icon={<Ban className="h-4 w-4" />} destructive onSelect={() => setSheet('cancel')}>
            {t('actions.cancel')}
          </MenuItem>
        </>
      )}
    </Menu>
  ) : undefined

  return (
    <Page width="lg" withActionBar>
      <PageHeader
        title={b?.guest.name ?? t('booking.title')}
        subtitle={b ? `${b.bookingNo}${b.room ? ` · ${t('booking.room')} ${b.room.label}` : ''}` : undefined}
        back={-1}
        fallback="/bookings"
        actions={headerActions}
      />

      <QueryState pending={bookingQ.isPending} error={bookingQ.error} onRetry={() => void bookingQ.refetch()} skeleton={<Skeleton className="h-64" />}>
        {!b ? (
          <EmptyState title={t('booking.notFound')} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={b.status} />
              <Badge tone="neutral">{sourceLabel(b.source)}</Badge>
              {b.folio && <BalanceText amount={b.folio.balance} />}
            </div>
            <Timeline b={b} tz={property.timezone} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <Card>
                  <CardHeader
                    title={t('booking.guest')}
                    action={
                      <Button variant="link" size="sm" asChild>
                        <Link to={`/guests/${b.guest.id}`}>{t('booking.viewGuest')}</Link>
                      </Button>
                    }
                  />
                  <CardContent>
                    <DefinitionList>
                      <DefinitionRow label={t('guests.name')} value={b.guest.name} />
                      <DefinitionRow
                        label={t('guests.phone')}
                        value={
                          b.guest.phone ? (
                            <a href={`tel:${b.guest.phone}`} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                              <Phone className="h-4 w-4" aria-hidden /> {formatPhone(b.guest.phone)}
                            </a>
                          ) : (
                            '—'
                          )
                        }
                      />
                      <DefinitionRow label={t('guests.nationality')} value={b.guest.nationality ?? '—'} />
                      <DefinitionRow
                        label={t('guests.idType')}
                        value={
                          b.guest.hasId ? (
                            <span className="text-settled">{t('booking.idOnFile')}</span>
                          ) : (
                            <Link to={`/guests/${b.guest.id}?edit=1`} className="text-warning underline-offset-4 hover:underline">
                              {t('booking.noId')} · {t('booking.addId')}
                            </Link>
                          )
                        }
                      />
                    </DefinitionList>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title={t('booking.stay')} />
                  <CardContent>
                    <DefinitionList>
                      <DefinitionRow
                        label={t('booking.room')}
                        value={
                          b.room ? (
                            <span className="inline-flex items-center gap-2">
                              <span>
                                {b.room.label} · {b.room.typeName}
                              </span>
                              <HkBadge status={b.room.hkStatus} />
                            </span>
                          ) : (
                            '—'
                          )
                        }
                      />
                      <DefinitionRow label={t('booking.dates')} value={<DateRange from={b.checkIn} to={b.checkOut} today={today} />} />
                      <DefinitionRow label={t('booking.nights')} value={tNights(b.nights)} />
                      <DefinitionRow label={t('booking.guests')} value={`${b.adults} ${t('booking.adults').toLowerCase()}${b.children ? ` · ${b.children} ${t('booking.children').toLowerCase()}` : ''}`} />
                      <DefinitionRow label={t('booking.rate')} value={<Money amount={b.nightlyRatePkr} />} />
                    </DefinitionList>
                    {b.notes && <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{b.notes}</p>}
                  </CardContent>
                </Card>
              </div>

              <FolioCard
                b={b}
                folio={folio}
                pending={folioQ.isPending}
                error={folioQ.error}
                showVoided={showVoided}
                onToggleVoided={() => setShowVoided((v) => !v)}
                canPost={Boolean(canPost)}
                canVoid={canVoid}
                canReopen={canReopen}
                onPayment={() => setSheet('payment')}
                onCharge={() => setSheet('charge')}
                onVoid={(item) => setVoidTarget(item)}
                onReopen={() => setSheet('reopen')}
                onClose={() => void doClose()}
                closing={close.isPending}
              />
            </div>

            <ActionBar>
              {b.status === 'confirmed' && canTransition && (
                <Button size="lg" className="flex-1" onClick={() => setSheet('checkin')}>
                  <LogIn className="h-5 w-5" aria-hidden />
                  {t('actions.checkIn')}
                </Button>
              )}
              {b.status === 'checked_in' && canTransition && (
                <Button size="lg" className="flex-1" onClick={() => setSheet('checkout')}>
                  <LogOut className="h-5 w-5" aria-hidden />
                  {t('actions.checkOut')}
                </Button>
              )}
              {canPost && (b.folio?.balance ?? 0) > 0 && (
                <Button size="lg" variant={b.status === 'checked_out' ? 'default' : 'outline'} className="flex-1" onClick={() => setSheet('payment')}>
                  <Wallet className="h-5 w-5" aria-hidden />
                  {t('actions.collect')}
                </Button>
              )}
              {b.status === 'checked_out' && (b.folio?.balance ?? 0) <= 0 && (
                <Button size="lg" variant="outline" className="flex-1" asChild>
                  <Link to={`/bookings/${b.id}/receipt`}>
                    <Printer className="h-5 w-5" aria-hidden />
                    {t('actions.receipt')}
                  </Link>
                </Button>
              )}
              {(b.status === 'cancelled' || b.status === 'no_show') && canCorrect && (
                <Button size="lg" variant="outline" className="flex-1" onClick={() => void transition('confirmed', undefined, 'toast.reinstated')} loading={setStatus.isPending}>
                  <RotateCcw className="h-5 w-5" aria-hidden />
                  {t('actions.reinstate')}
                </Button>
              )}
            </ActionBar>

            {sheet === 'checkin' && <CheckInSheet booking={b} open onOpenChange={(o) => !o && setSheet(null)} />}
            {sheet === 'checkout' && <CheckOutSheet booking={b} open onOpenChange={(o) => !o && setSheet(null)} />}
            {(sheet === 'payment' || sheet === 'charge') && <PostItemSheet booking={b} mode={sheet} open onOpenChange={(o) => !o && setSheet(null)} />}
            {sheet === 'move' && <MoveRoomSheet booking={b} open onOpenChange={(o) => !o && setSheet(null)} />}
            <ReasonSheet
              open={sheet === 'cancel'}
              onOpenChange={(o) => !o && setSheet(null)}
              title={t('actions.cancel')}
              prompt={t('common.reason')}
              confirmLabel={t('actions.cancel')}
              destructive
              busy={setStatus.isPending}
              error={sheetError}
              onConfirm={(reason) => transition('cancelled', reason, 'toast.bookingCancelled')}
            >
              {b.folio && b.folio.payments > 0 && <p className="text-sm text-muted-foreground">{t('booking.credit')}: {formatPKR(b.folio.payments)}</p>}
            </ReasonSheet>
            <ReasonSheet
              open={sheet === 'noshow'}
              onOpenChange={(o) => !o && setSheet(null)}
              title={t('actions.noShow')}
              prompt={t('common.reason')}
              confirmLabel={t('actions.noShow')}
              busy={setStatus.isPending}
              error={sheetError}
              onConfirm={(reason) => transition('no_show', reason, 'toast.noShow')}
            />
            <ReasonSheet
              open={sheet === 'reopen'}
              onOpenChange={(o) => !o && setSheet(null)}
              title={t('folio.reopen')}
              prompt={t('folio.reopenReason')}
              confirmLabel={t('folio.reopen')}
              busy={reopen.isPending}
              error={sheetError}
              onConfirm={doReopen}
            />
            <ReasonSheet
              open={voidTarget !== null}
              onOpenChange={(o) => !o && setVoidTarget(null)}
              title={t('folio.voidTitle')}
              description={voidTarget ? `${itemTitle(voidTarget)} · ${formatPKR(voidTarget.amountPkr + voidTarget.taxPkr)}` : undefined}
              prompt={t('folio.voidReason')}
              confirmLabel={t('folio.void')}
              destructive
              busy={voidItem.isPending}
              error={sheetError}
              onConfirm={doVoid}
            />
          </>
        )}
      </QueryState>
    </Page>
  )
}

function Timeline({ b, tz }: { b: BookingVM; tz: string }) {
  const rows: string[] = [t('booking.created', { when: fmtInstant(b.createdAt, tz) })]
  if (b.checkedInAt) rows.push(t('booking.checkedIn', { when: fmtInstant(b.checkedInAt, tz) }))
  if (b.checkedOutAt) rows.push(t('booking.checkedOut', { when: fmtInstant(b.checkedOutAt, tz) }))
  if (b.cancelledAt) rows.push(t('booking.cancelled', { when: fmtInstant(b.cancelledAt, tz) }) + (b.cancellationReason ? ` — ${b.cancellationReason}` : ''))
  if (b.noShowAt) rows.push(t('booking.noShow', { when: fmtInstant(b.noShowAt, tz) }))
  if (b.checkoutOverrideReason) rows.push(t('booking.overrideNote', { reason: b.checkoutOverrideReason }))
  return <p className="text-xs text-muted-foreground">{rows.join(' · ')}</p>
}

function itemTitle(i: FolioItemVM): string {
  if (i.kind === 'payment' || i.kind === 'refund') return `${kindLabel(i.kind)} · ${i.method ? methodLabel(i.method) : ''}`
  if (i.category === 'room' && i.serviceDate) return t('folio.roomNight', { date: fmtShort(i.serviceDate) })
  return i.description || categoryLabel(i.category)
}

interface FolioCardProps {
  b: BookingVM
  folio: FolioVM | null
  pending: boolean
  error: unknown
  showVoided: boolean
  onToggleVoided: () => void
  canPost: boolean
  canVoid: boolean
  canReopen: boolean
  onPayment: () => void
  onCharge: () => void
  onVoid: (item: FolioItemVM) => void
  onReopen: () => void
  onClose: () => void
  closing: boolean
}

function FolioCard({ b, folio, pending, error, showVoided, onToggleVoided, canPost, canVoid, canReopen, onPayment, onCharge, onVoid, onReopen, onClose, closing }: FolioCardProps) {
  const { property } = useTenant()
  const staffName = useStaffNames()
  const rows = useMemo(() => {
    if (!folio) return []
    const live = folio.items.filter((i) => showVoided || !i.voidedAt)
    // Room nights collapse into one line unless the stay is short or the user wants detail.
    const nights = live.filter((i) => i.kind === 'charge' && i.category === 'room' && i.source === 'auto' && !i.voidedAt)
    const rest = live.filter((i) => !(i.kind === 'charge' && i.category === 'room' && i.source === 'auto' && !i.voidedAt))
    const out: { key: string; title: string; sub?: string; amount: number; kind: FolioItemVM['kind']; item?: FolioItemVM; voided?: boolean }[] = []
    if (nights.length > 0) {
      const total = nights.reduce((s, i) => s + i.amountPkr, 0)
      const dates = nights.map((i) => i.serviceDate).filter(Boolean).sort()
      out.push({
        key: 'room',
        title: `${t('booking.room')} · ${tNights(nights.length)}`,
        sub: dates.length ? `${fmtShort(dates[0]!)} → ${fmtShort(addDaysStr(dates[dates.length - 1]!, 1))} · ${formatPKR(nights[0]!.amountPkr)}` : undefined,
        amount: total,
        kind: 'charge',
      })
    }
    for (const i of rest) {
      out.push({
        key: i.id,
        title: itemTitle(i),
        sub: [i.receiptNo, i.reference, fmtInstant(i.postedAt, property.timezone), staffName(i.postedBy)].filter(Boolean).join(' · ') + (i.voidedAt ? ` · ${t('folio.voidedBy', { when: fmtInstant(i.voidedAt, property.timezone), reason: i.voidReason ?? '' })}` : ''),
        amount: i.amountPkr,
        kind: i.kind,
        item: i,
        voided: Boolean(i.voidedAt),
      })
    }
    return out
  }, [folio, showVoided, property.timezone, staffName])

  const voidedCount = folio?.items.filter((i) => i.voidedAt).length ?? 0
  const taxLabel = property.taxMode !== 'none' && property.taxName ? t('folio.tax', { name: property.taxName, rate: property.taxRatePct }) : t('folio.taxPlain')

  return (
    <Card>
      <CardHeader
        title={`${t('booking.folio')}${folio?.no ? ` · ${folio.no}` : ''}${folio?.status === 'closed' ? ` · ${t('folio.closed')}` : ''}`}
        action={
          voidedCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={onToggleVoided}>
              {showVoided ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              {showVoided ? t('folio.hideVoided') : t('folio.showVoided')}
            </Button>
          ) : undefined
        }
      />
      <CardContent>
        <QueryState pending={pending} error={error}>
          {!folio || rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('folio.empty')}</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {rows.map((r) => (
                <li key={r.key} className={cn('flex items-start justify-between gap-3 py-2', r.voided && 'opacity-60')}>
                  <div className="min-w-0">
                    <p className={cn('text-base', r.voided && 'line-through')}>{r.title}</p>
                    {r.sub && <p className="tnum text-xs text-muted-foreground">{r.sub}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={cn('tnum text-base font-medium', r.kind === 'payment' && 'text-settled', r.kind === 'refund' && 'text-credit', r.kind === 'discount' && 'text-credit')}>
                      {r.kind === 'payment' || r.kind === 'discount' ? '− ' : r.kind === 'refund' ? '+ ' : ''}
                      {formatPKR(r.amount)}
                    </span>
                    {r.item && !r.voided && canVoid && folio.status === 'open' && (
                      <Button variant="ghost" size="icon-sm" aria-label={t('folio.void')} onClick={() => onVoid(r.item!)}>
                        <Ban className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {folio && (
            <DefinitionList className="mt-3 border-t border-border pt-2">
              <DefinitionRow label={t('folio.subtotal')} value={<Money amount={folio.totalCharges} />} />
              {folio.totalTax > 0 && <DefinitionRow label={taxLabel} value={<Money amount={folio.totalTax} />} />}
              <DefinitionRow label={t('folio.paid')} value={<Money amount={folio.totalPayments} />} />
              <DefinitionRow
                label={folio.balance > 0 ? t('folio.balance') : folio.balance < 0 ? t('folio.credit') : t('booking.settled')}
                value={<Money amount={Math.abs(folio.balance)} className={folio.balance > 0 ? 'text-due' : folio.balance < 0 ? 'text-credit' : 'text-settled'} />}
                emphasis
              />
            </DefinitionList>
          )}
          {canPost && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" className="w-full" onClick={onPayment}>
                <Wallet className="h-4 w-4" aria-hidden />
                {t('folio.addPayment')}
              </Button>
              <Button variant="outline" className="w-full" onClick={onCharge}>
                <ClipboardList className="h-4 w-4" aria-hidden />
                {t('folio.addCharge')}
              </Button>
            </div>
          )}
          {folio?.status === 'closed' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t('folio.closedHint')}</span>
              {canReopen && (
                <Button variant="outline" size="sm" onClick={onReopen}>
                  {t('folio.reopen')}
                </Button>
              )}
            </div>
          )}
          {folio?.status === 'open' && b.status !== 'confirmed' && b.status !== 'checked_in' && folio.balance === 0 && canReopen && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onClose} loading={closing}>
              {t('folio.close')}
            </Button>
          )}
        </QueryState>
      </CardContent>
    </Card>
  )
}
