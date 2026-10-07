import { formatPKR, t, type PaymentMethod } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { BookingRow } from '@/components/BookingRow'
import { Panel } from '@/components/Panel'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useRooms, useTodayPayments } from '@/data/queries'
import { ACTIVE_STATUSES, OCCUPYING_STATUSES, type BookingVM } from '@/data/types'
import { fmtLong, isNightCovered, todayStr } from '@/lib/dates'
import { methodLabel } from '@/lib/labels'

export function TodayScreen() {
  const { property } = useTenant()
  const today = todayStr()
  const bookingsQ = useBookings(property.id)
  const roomsQ = useRooms(property.id)
  const paymentsQ = useTodayPayments(property.id)

  if (bookingsQ.isPending || roomsQ.isPending || paymentsQ.isPending) return <Loading />
  const error = bookingsQ.error ?? roomsQ.error ?? paymentsQ.error
  if (error) {
    return (
      <ErrorNote
        message={error.message}
        onRetry={() => {
          void bookingsQ.refetch()
          void roomsQ.refetch()
          void paymentsQ.refetch()
        }}
      />
    )
  }

  const bookings = bookingsQ.data ?? []
  const rooms = roomsQ.data ?? []
  const payments = paymentsQ.data ?? []

  const arrivals = bookings.filter((b) => b.checkIn === today && ACTIVE_STATUSES.has(b.status))
  const departures = bookings.filter(
    (b) => b.checkOut === today && (b.status === 'checked_in' || b.status === 'checked_out'),
  )
  const inHouse = bookings.filter((b) => b.status === 'checked_in')
  const occupied = bookings.filter(
    (b) => OCCUPYING_STATUSES.has(b.status) && isNightCovered(b.checkIn, b.checkOut, today),
  ).length
  const totalRooms = rooms.length
  const occupancyPct = totalRooms ? Math.round((occupied / totalRooms) * 100) : 0

  const cashTotal = payments.reduce((sum, p) => sum + p.amountPkr, 0)
  const byMethod = payments.reduce<Partial<Record<PaymentMethod, number>>>((acc, p) => {
    acc[p.method] = (acc[p.method] ?? 0) + p.amountPkr
    return acc
  }, {})

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-4 pb-24 md:max-w-5xl md:px-6 md:py-6 md:pb-8">
      <p className="text-sm text-muted-foreground md:text-base">{fmtLong(today)}</p>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label={t('today.arrivals')} value={arrivals.length} />
        <Kpi label={t('today.departures')} value={departures.length} />
        <Kpi label={t('today.inHouse')} value={inHouse.length} />
        <Kpi
          label={t('today.occupancy')}
          value={`${occupancyPct}%`}
          sub={t('common.of', { a: occupied, b: totalRooms })}
        />
      </div>

      <Panel title={t('today.cashToday')}>
        <p className="text-2xl font-semibold">{formatPKR(cashTotal)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.entries(byMethod) as [PaymentMethod, number][]).map(([method, amount]) => (
            <Badge key={method} className="border-border text-muted-foreground">
              {methodLabel(method)} · {formatPKR(amount)}
            </Badge>
          ))}
        </div>
      </Panel>

      <div className="space-y-5 md:grid md:grid-cols-3 md:items-start md:gap-4 md:space-y-0">
        <Section title={t('today.arrivalsToday')} bookings={arrivals} />
        <Section title={t('today.departuresToday')} bookings={departures} />
        <Section title={t('today.inHouseNow')} bookings={inHouse} />
      </div>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-card-foreground md:p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold leading-tight md:text-3xl">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Section({ title, bookings }: { title: string; bookings: BookingVM[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">({bookings.length})</span>
      </h2>
      {bookings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
          {t('today.none')}
        </p>
      ) : (
        bookings.map((b) => <BookingRow key={b.id} booking={b} />)
      )}
    </section>
  )
}
