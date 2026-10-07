import { useState } from 'react'
import { formatPKR, t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { EmptyState, SkeletonRows } from '@/components/ui/feedback'
import { Page, PageHeader, SectionTitle } from '@/components/patterns/Page'
import { BookingRow, KpiTile } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { CheckInSheet } from '@/components/booking/CheckInSheet'
import { CheckOutSheet } from '@/components/booking/CheckOutSheet'
import { PostItemSheet } from '@/components/booking/PostItemSheet'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useTodayBookings } from '@/data/bookings'
import { useDailyReport } from '@/data/reports'
import type { BookingVM } from '@/data/types'
import { fmtLong, fmtMedium } from '@/lib/clock'
import { methodLabel } from '@/lib/labels'

type Action = { kind: 'checkin' | 'checkout' | 'collect'; booking: BookingVM } | null

export default function TodayScreen() {
  const { property, can } = useTenant()
  const today = useHotelToday()
  const bookingsQ = useTodayBookings()
  const reportQ = useDailyReport(today)
  const [action, setAction] = useState<Action>(null)

  const bookings = bookingsQ.data ?? []
  const byRoom = (a: BookingVM, b: BookingVM) => (a.room?.label ?? '').localeCompare(b.room?.label ?? '', undefined, { numeric: true })

  const arrivalsExpected = bookings.filter((b) => b.checkIn === today && b.status === 'confirmed').sort(byRoom)
  const arrived = bookings.filter((b) => b.checkIn === today && (b.status === 'checked_in' || b.status === 'checked_out')).sort(byRoom)
  const departuresDue = bookings.filter((b) => b.checkOut === today && b.status === 'checked_in').sort(byRoom)
  const left = bookings.filter((b) => b.checkOut === today && b.status === 'checked_out').sort(byRoom)
  const lateArrivals = bookings.filter((b) => b.status === 'confirmed' && b.checkIn < today)
  const overstays = bookings.filter((b) => b.status === 'checked_in' && b.checkOut < today)
  const inHouse = bookings.filter((b) => b.status === 'checked_in').sort(byRoom)
  const noShowsToday = bookings.filter((b) => b.checkIn === today && b.status === 'no_show')

  // Occupancy comes from daily_report so Today and the report never disagree.
  const report = reportQ.data
  const sellable = report ? Math.max(report.rooms.total - report.rooms.outOfOrder, 0) : 0
  const occupied = report ? Math.min(report.rooms.occupied, sellable) : 0
  const freeTonight = Math.max(sellable - occupied, 0)
  const occupancyPct = sellable ? Math.round((occupied / sellable) * 100) : 0
  const canAct = can('bookings.transition')
  const canCollect = can('folio.post')

  return (
    <Page width="xl">
      <PageHeader title={t('today.title')} subtitle={fmtLong(today)} />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <KpiTile
          label={t('today.arrivals')}
          value={<>{arrived.length}<span className="text-base font-normal text-muted-foreground"> / {arrived.length + arrivalsExpected.length + noShowsToday.length}</span></>}
          sub={`${arrivalsExpected.length} ${t('today.expected').toLowerCase()}`}
          to="/bookings?filter=arriving"
        />
        <KpiTile
          label={t('today.departures')}
          value={<>{left.length}<span className="text-base font-normal text-muted-foreground"> / {left.length + departuresDue.length}</span></>}
          sub={`${departuresDue.length} ${t('today.dueToLeave').toLowerCase()}`}
          to="/bookings?filter=departing"
        />
        <KpiTile label={t('today.inHouse')} value={inHouse.length} sub={report ? t('today.freeTonight') + `: ${freeTonight}` : undefined} to="/bookings?filter=inHouse" />
        <KpiTile label={t('today.occupancy')} value={report ? `${occupancyPct}%` : '—'} sub={report ? t('today.ofRooms', { sold: occupied, total: sellable }) : undefined} to="/rooms" />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <KpiTile
          label={t('today.dueFromGuests')}
          value={report ? formatPKR(report.outstanding) : '—'}
          sub={report ? t('report.outstandingCount', { n: report.outstandingCount }) : undefined}
          to="/bookings?filter=due"
          tone={report && report.outstanding > 0 ? 'due' : 'default'}
          compact
        />
        <KpiTile
          label={t('today.collected')}
          value={report ? formatPKR(report.paymentsTotal) : '—'}
          compact
          sub={
            report
              ? Object.entries(report.payments)
                  .filter(([, v]) => v !== 0)
                  .map(([m, v]) => `${methodLabel(m as never)} ${formatPKR(v)}`)
                  .join(' · ') || t('common.none')
              : undefined
          }
          to="/cash"
          tone="success"
        />
      </div>

      <QueryState pending={bookingsQ.isPending} error={bookingsQ.error} onRetry={() => void bookingsQ.refetch()} skeleton={<SkeletonRows rows={5} />}>
        {(lateArrivals.length > 0 || overstays.length > 0) && (
          <section className="space-y-2">
            <SectionTitle count={lateArrivals.length + overstays.length}>
              <span className="text-warning">{t('today.overdue')}</span>
            </SectionTitle>
            {lateArrivals.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                today={today}
                note={<span className="text-warning">{t('today.lateArrival', { date: fmtMedium(b.checkIn) })}</span>}
                action={canAct && <Button size="sm" onClick={() => setAction({ kind: 'checkin', booking: b })}>{t('actions.checkIn')}</Button>}
              />
            ))}
            {overstays.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                today={today}
                note={<span className="text-warning">{t('today.overstay', { date: fmtMedium(b.checkOut) })}</span>}
                action={canAct && <Button size="sm" onClick={() => setAction({ kind: 'checkout', booking: b })}>{t('actions.checkOut')}</Button>}
              />
            ))}
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="space-y-2">
            <SectionTitle count={arrivalsExpected.length + arrived.length}>{t('today.arrivals')}</SectionTitle>
            {arrivalsExpected.length === 0 && arrived.length === 0 ? (
              <EmptyState title={t('today.noneArriving')} />
            ) : (
              <>
                {arrivalsExpected.map((b) => (
                  <BookingRow key={b.id} booking={b} today={today} action={canAct && <Button size="sm" onClick={() => setAction({ kind: 'checkin', booking: b })}>{t('actions.checkIn')}</Button>} />
                ))}
                {arrived.length > 0 && (
                  <>
                    <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('today.arrived')} ({arrived.length})</p>
                    {arrived.map((b) => (
                      <BookingRow key={b.id} booking={b} today={today} />
                    ))}
                  </>
                )}
              </>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle count={departuresDue.length + left.length}>{t('today.departures')}</SectionTitle>
            {departuresDue.length === 0 && left.length === 0 ? (
              <EmptyState title={t('today.noneDeparting')} />
            ) : (
              <>
                {departuresDue.map((b) => (
                  <BookingRow key={b.id} booking={b} today={today} action={canAct && <Button size="sm" onClick={() => setAction({ kind: 'checkout', booking: b })}>{t('actions.checkOut')}</Button>} />
                ))}
                {left.length > 0 && (
                  <>
                    <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('today.left')} ({left.length})</p>
                    {left.map((b) => (
                      <BookingRow key={b.id} booking={b} today={today} />
                    ))}
                  </>
                )}
              </>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle count={inHouse.length}>{t('today.inHouseNow')}</SectionTitle>
            {inHouse.length === 0 ? (
              <EmptyState title={t('today.noneInHouse')} />
            ) : (
              inHouse.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  today={today}
                  action={
                    canCollect && (b.folio?.balance ?? 0) > 0 ? (
                      <Button size="sm" variant="outline" onClick={() => setAction({ kind: 'collect', booking: b })}>
                        {t('actions.collect')}
                      </Button>
                    ) : undefined
                  }
                />
              ))
            )}
          </section>
        </div>
      </QueryState>

      {action?.kind === 'checkin' && <CheckInSheet booking={action.booking} open onOpenChange={(o) => !o && setAction(null)} />}
      {action?.kind === 'checkout' && <CheckOutSheet booking={action.booking} open onOpenChange={(o) => !o && setAction(null)} />}
      {action?.kind === 'collect' && <PostItemSheet booking={action.booking} mode="payment" open onOpenChange={(o) => !o && setAction(null)} />}
      <p className="sr-only">{property.name}</p>
    </Page>
  )
}
