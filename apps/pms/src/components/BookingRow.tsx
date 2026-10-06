import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { fmtShort, nightsBetween } from '@/lib/dates'
import { nightsLabel, sourceLabel } from '@/lib/labels'
import { guestById, roomById, roomTypeById, type SampleBooking } from '@/mock/sample-bookings'

export function BookingRow({ booking }: { booking: SampleBooking }) {
  const guest = guestById(booking.guestId)
  const room = roomById(booking.roomId)
  const roomType = roomTypeById(booking.roomTypeId)
  const nights = nightsBetween(booking.checkIn, booking.checkOut)

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm active:bg-accent"
    >
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-muted">
        <span className="text-sm font-semibold leading-none">{room?.label}</span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">
          {roomType?.name.split(' ')[0]}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{guest?.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {fmtShort(booking.checkIn)} → {fmtShort(booking.checkOut)} · {nightsLabel(nights)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <StatusBadge status={booking.status} />
          <Badge className="border-border text-muted-foreground">{sourceLabel(booking.source)}</Badge>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
