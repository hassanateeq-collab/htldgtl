import { formatPKR, t } from '@hotel-digital/shared'
import { BookingRow } from '@/components/BookingRow'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings } from '@/data/queries'
import { owesMoney, type BookingVM } from '@/data/types'
import { todayStr } from '@/lib/dates'

const byCheckIn = (a: BookingVM, b: BookingVM) => a.checkIn.localeCompare(b.checkIn)

export function BookingsScreen() {
  const { property } = useTenant()
  const bookingsQ = useBookings(property.id)

  if (bookingsQ.isPending) return <Loading />
  if (bookingsQ.isError) return <ErrorNote message={bookingsQ.error.message} onRetry={() => void bookingsQ.refetch()} />

  const today = todayStr()
  const all = bookingsQ.data
  // Money owed by guests who are in-house or have already left.
  const outstanding = all
    .filter((b) => owesMoney(b) && (b.status === 'checked_in' || b.status === 'checked_out'))
    .sort(byCheckIn)
  const totalDue = outstanding.reduce((sum, b) => sum + (b.balance ?? 0), 0)
  const current = all.filter((b) => b.checkOut >= today && b.status !== 'cancelled').sort(byCheckIn)
  const past = all.filter((b) => b.checkOut < today || b.status === 'cancelled').sort((a, b) => byCheckIn(b, a))

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-4 pb-24 md:max-w-5xl md:px-6 md:py-6 md:pb-8">
      {outstanding.length > 0 && (
        <Group
          title={t('bookings.outstanding')}
          subtitle={t('bookings.totalDue', { amount: formatPKR(totalDue) })}
          bookings={outstanding}
          tone="alert"
        />
      )}
      <div className="space-y-5 md:grid md:grid-cols-2 md:items-start md:gap-6 md:space-y-0">
        <Group title={t('bookings.current')} bookings={current} />
        <Group title={t('bookings.past')} bookings={past} />
      </div>
    </div>
  )
}

function Group({
  title,
  subtitle,
  bookings,
  tone,
}: {
  title: string
  subtitle?: string
  bookings: BookingVM[]
  tone?: 'alert'
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={tone === 'alert' ? 'text-sm font-semibold text-red-700' : 'text-sm font-semibold'}>
          {title} <span className="font-normal text-muted-foreground">({bookings.length})</span>
        </h2>
        {subtitle && <span className="text-sm font-semibold text-red-700">{subtitle}</span>}
      </div>
      {bookings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
          {t('bookings.empty')}
        </p>
      ) : (
        <div className={tone === 'alert' ? 'space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0' : 'space-y-2'}>
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </div>
      )}
    </section>
  )
}
