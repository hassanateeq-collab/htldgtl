import { formatPKR, t, type PaymentMethod } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { BookingRow } from '@/components/BookingRow'
import { Panel } from '@/components/Panel'
import { fmtLong } from '@/lib/dates'
import { methodLabel } from '@/lib/labels'
import { sampleRooms } from '@/mock/sample-property'
import {
  TODAY,
  isActiveBooking,
  occupiedOnNight,
  sampleBookings,
  samplePayments,
  type SampleBooking,
} from '@/mock/sample-bookings'

export function TodayScreen() {
  const arrivals = sampleBookings.filter((bk) => bk.checkIn === TODAY && isActiveBooking(bk))
  const departures = sampleBookings.filter(
    (bk) => bk.checkOut === TODAY && (bk.status === 'checked_in' || bk.status === 'checked_out'),
  )
  const inHouse = sampleBookings.filter((bk) => bk.status === 'checked_in')

  const occupied = occupiedOnNight(TODAY).length
  const totalRooms = sampleRooms.length
  const occupancyPct = totalRooms ? Math.round((occupied / totalRooms) * 100) : 0

  const todayPayments = samplePayments.filter((p) => p.receivedOn === TODAY)
  const cashTotal = todayPayments.reduce((sum, p) => sum + p.amountPkr, 0)
  const byMethod = todayPayments.reduce<Partial<Record<PaymentMethod, number>>>((acc, p) => {
    acc[p.method] = (acc[p.method] ?? 0) + p.amountPkr
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-4 pb-24">
      <p className="text-sm text-muted-foreground">{fmtLong(TODAY)}</p>

      <div className="grid grid-cols-2 gap-2">
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

      <Section title={t('today.arrivalsToday')} bookings={arrivals} />
      <Section title={t('today.departuresToday')} bookings={departures} />
      <Section title={t('today.inHouseNow')} bookings={inHouse} />
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Section({ title, bookings }: { title: string; bookings: SampleBooking[] }) {
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
        bookings.map((bk) => <BookingRow key={bk.id} booking={bk} />)
      )}
    </section>
  )
}
