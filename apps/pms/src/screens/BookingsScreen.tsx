import { t } from '@hotel-digital/shared'
import { BookingRow } from '@/components/BookingRow'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings } from '@/data/queries'
import type { BookingVM } from '@/data/types'
import { todayStr } from '@/lib/dates'

const byCheckIn = (a: BookingVM, b: BookingVM) => a.checkIn.localeCompare(b.checkIn)

export function BookingsScreen() {
  const { property } = useTenant()
  const bookingsQ = useBookings(property.id)

  if (bookingsQ.isPending) return <Loading />
  if (bookingsQ.isError) return <ErrorNote message={bookingsQ.error.message} onRetry={() => void bookingsQ.refetch()} />

  const today = todayStr()
  const all = bookingsQ.data
  const current = all.filter((b) => b.checkOut >= today && b.status !== 'cancelled').sort(byCheckIn)
  const past = all.filter((b) => b.checkOut < today || b.status === 'cancelled').sort((a, b) => byCheckIn(b, a))

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-4 pb-24">
      <Group title={t('bookings.current')} bookings={current} />
      <Group title={t('bookings.past')} bookings={past} />
    </div>
  )
}

function Group({ title, bookings }: { title: string; bookings: BookingVM[] }) {
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
        bookings.map((b) => <BookingRow key={b.id} booking={b} />)
      )}
    </section>
  )
}
