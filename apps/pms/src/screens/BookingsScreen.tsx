import { t } from '@hotel-digital/shared'
import { BookingRow } from '@/components/BookingRow'
import { TODAY, sampleBookings, type SampleBooking } from '@/mock/sample-bookings'

const byCheckIn = (a: SampleBooking, b: SampleBooking) => a.checkIn.localeCompare(b.checkIn)

export function BookingsScreen() {
  const current = sampleBookings
    .filter((bk) => bk.checkOut >= TODAY && bk.status !== 'cancelled')
    .sort(byCheckIn)
  const past = sampleBookings
    .filter((bk) => bk.checkOut < TODAY || bk.status === 'cancelled')
    .sort((a, b) => byCheckIn(b, a))

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-4 pb-24">
      <Group title={t('bookings.current')} bookings={current} />
      <Group title={t('bookings.past')} bookings={past} />
    </div>
  )
}

function Group({ title, bookings }: { title: string; bookings: SampleBooking[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">({bookings.length})</span>
      </h2>
      {bookings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
          {t('bookings.empty')}
        </p>
      ) : (
        bookings.map((bk) => <BookingRow key={bk.id} booking={bk} />)
      )}
    </section>
  )
}
