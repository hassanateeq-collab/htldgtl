import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { formatPKR, t } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { fmtShort, nightsBetween } from '@/lib/dates'
import { methodLabel, nightsLabel, sourceLabel } from '@/lib/labels'
import {
  bookingById,
  guestById,
  paymentsForBooking,
  roomById,
  roomTypeById,
} from '@/mock/sample-bookings'

export function BookingDetailScreen() {
  const { id } = useParams()
  const booking = bookingById(id ?? '')

  if (!booking) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">{t('booking.notFound')}</p>
      </div>
    )
  }

  const guest = guestById(booking.guestId)
  const room = roomById(booking.roomId)
  const roomType = roomTypeById(booking.roomTypeId)
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const charges = nights * booking.nightlyRatePkr
  const payments = paymentsForBooking(booking.id)
  const paid = payments.reduce((sum, p) => sum + p.amountPkr, 0)
  const balance = charges - paid

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-4 pb-24">
      <BackLink />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{booking.bookingNo}</p>
          <h2 className="text-xl font-semibold">{guest?.name}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={booking.status} />
          <Badge className="border-border text-muted-foreground">{sourceLabel(booking.source)}</Badge>
        </div>
      </div>

      <Panel title={t('booking.guest')}>
        <Row label={t('booking.guest')} value={guest?.name ?? '—'} />
        <Row label="Phone" value={guest?.phone ?? '—'} />
        <Row label="Nationality" value={guest?.nationality ?? '—'} />
      </Panel>

      <Panel title={t('booking.stay')}>
        <Row label={t('booking.room')} value={`${room?.label ?? '—'} · ${roomType?.name ?? ''}`} />
        <Row
          label={t('booking.dates')}
          value={`${fmtShort(booking.checkIn)} → ${fmtShort(booking.checkOut)}`}
        />
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
        <Row
          label={`${t('booking.roomCharges')} (${nights} × ${formatPKR(booking.nightlyRatePkr)})`}
          value={formatPKR(charges)}
        />
        <div className="my-2 border-t border-border" />
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          payments.map((p) => (
            <Row
              key={p.id}
              label={`${methodLabel(p.method)}${p.reference ? ` · ${p.reference}` : ''} · ${fmtShort(p.receivedOn)}`}
              value={`− ${formatPKR(p.amountPkr)}`}
            />
          ))
        )}
        <div className="my-2 border-t border-border" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">
            {balance > 0 ? t('booking.balance') : t('booking.settled')}
          </span>
          <span className={balance > 0 ? 'text-lg font-semibold' : 'text-lg font-semibold text-green-700'}>
            {formatPKR(Math.max(balance, 0))}
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
