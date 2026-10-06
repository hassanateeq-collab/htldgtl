import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { formatPKR, t } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useFolio } from '@/data/queries'
import { fmtShort, nightsBetween } from '@/lib/dates'
import { methodLabel, nightsLabel, sourceLabel } from '@/lib/labels'

export function BookingDetailScreen() {
  const { id } = useParams()
  const { property } = useTenant()
  const bookingsQ = useBookings(property.id)
  const folioQ = useFolio(id)

  if (bookingsQ.isPending || folioQ.isPending) return <Loading />
  const error = bookingsQ.error ?? folioQ.error
  if (error) {
    return (
      <ErrorNote
        message={error.message}
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

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-4 pb-24">
      <BackLink />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{booking.bookingNo}</p>
          <h2 className="text-xl font-semibold">{booking.guest?.name ?? '—'}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={booking.status} />
          <Badge className="border-border text-muted-foreground">{sourceLabel(booking.source)}</Badge>
        </div>
      </div>

      <Panel title={t('booking.guest')}>
        <Row label={t('booking.guest')} value={booking.guest?.name ?? '—'} />
        <Row label="Phone" value={booking.guest?.phone ?? '—'} />
        <Row label="Nationality" value={booking.guest?.nationality ?? '—'} />
      </Panel>

      <Panel title={t('booking.stay')}>
        <Row
          label={t('booking.room')}
          value={`${booking.roomLabel ?? '—'} · ${booking.roomTypeName ?? ''}`}
        />
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

      <Panel title={t('booking.folio')}>
        {!folio || folio.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          folio.items.map((item) => (
            <Row
              key={item.id}
              label={
                item.kind === 'payment'
                  ? `${methodLabel(item.method ?? 'cash')}${item.reference ? ` · ${item.reference}` : ''} · ${fmtShort(item.postedAt.slice(0, 10))}`
                  : item.description
              }
              value={item.kind === 'payment' ? `− ${formatPKR(item.amountPkr)}` : formatPKR(item.amountPkr)}
            />
          ))
        )}
        <div className="my-2 border-t border-border" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">
            {(folio?.balance ?? 0) > 0 ? t('booking.balance') : t('booking.settled')}
          </span>
          <span
            className={
              (folio?.balance ?? 0) > 0 ? 'text-lg font-semibold' : 'text-lg font-semibold text-green-700'
            }
          >
            {formatPKR(Math.max(folio?.balance ?? 0, 0))}
          </span>
        </div>
      </Panel>
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
