import { Link } from 'react-router-dom'
import type { BookingStatus } from '@hotel-digital/shared'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useRooms, useRoomTypes } from '@/data/queries'
import { OCCUPYING_STATUSES, type BookingVM } from '@/data/types'
import { addDaysStr, daysBetween, fmtDay, fmtDayNum, isNightCovered, todayStr, type DateStr } from '@/lib/dates'
import { statusLabel } from '@/lib/labels'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'

// Tape chart geometry. Bars start and end mid-cell so a same-day
// check-out / check-in in one room never visually overlaps.
const COL_W = 56
const LABEL_W = 60
const ROW_H = 44

type DrawnStatus = Exclude<BookingStatus, 'cancelled'>
const barStyles: Record<DrawnStatus, string> = {
  confirmed: 'bg-blue-500 text-white',
  checked_in: 'bg-green-600 text-white',
  checked_out: 'bg-zinc-300 text-zinc-700',
  no_show: 'bg-red-400 text-white',
}

export function CalendarScreen() {
  const { property } = useTenant()
  const roomTypesQ = useRoomTypes(property.id)
  const roomsQ = useRooms(property.id)
  const bookingsQ = useBookings(property.id)
  const desktop = useIsDesktop()

  if (roomTypesQ.isPending || roomsQ.isPending || bookingsQ.isPending) return <Loading />
  const error = roomTypesQ.error ?? roomsQ.error ?? bookingsQ.error
  if (error) {
    return (
      <ErrorNote
        message={error.message}
        onRetry={() => {
          void roomTypesQ.refetch()
          void roomsQ.refetch()
          void bookingsQ.refetch()
        }}
      />
    )
  }

  const roomTypes = roomTypesQ.data ?? []
  const rooms = roomsQ.data ?? []
  const bookings = bookingsQ.data ?? []
  const days = desktop ? 28 : 14
  const gridW = days * COL_W
  const today = todayStr()
  const start: DateStr = addDaysStr(today, -2)
  const dates: DateStr[] = Array.from({ length: days }, (_, i) => addDaysStr(start, i))
  const todayIdx = daysBetween(start, today)
  const totalRooms = rooms.length

  const occupiedOn = (night: DateStr) =>
    bookings.filter((b) => OCCUPYING_STATUSES.has(b.status) && isNightCovered(b.checkIn, b.checkOut, night)).length

  return (
    <div className="flex h-[calc(100svh-7rem)] flex-col md:h-svh">
      <div className="flex-1 overflow-auto">
        <div style={{ width: LABEL_W + gridW }}>
          {/* Date header */}
          <div className="sticky top-0 z-20 flex bg-background">
            <div
              className="sticky left-0 z-30 shrink-0 border-b border-r border-border bg-background"
              style={{ width: LABEL_W }}
            />
            {dates.map((ds) => (
              <div
                key={ds}
                className={cn(
                  'shrink-0 border-b border-l border-border py-1 text-center',
                  ds === today && 'bg-accent',
                )}
                style={{ width: COL_W }}
              >
                <div className="text-[10px] uppercase text-muted-foreground">{fmtDay(ds)}</div>
                <div className="text-sm font-semibold leading-tight">{fmtDayNum(ds)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {occupiedOn(ds)}/{totalRooms}
                </div>
              </div>
            ))}
          </div>

          {/* Rooms grouped by type */}
          {roomTypes.map((rt) => (
            <div key={rt.id}>
              <div className="flex">
                <div
                  className="sticky left-0 z-10 shrink-0 border-r border-border bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
                  style={{ width: LABEL_W }}
                >
                  {rt.name}
                </div>
                <div className="bg-muted/60" style={{ width: gridW, height: 24 }} />
              </div>

              {rooms
                .filter((room) => room.roomTypeId === rt.id)
                .map((room) => (
                  <div key={room.id} className="flex" style={{ height: ROW_H }}>
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center border-b border-r border-border bg-background px-2 text-sm font-medium"
                      style={{ width: LABEL_W }}
                    >
                      {room.label}
                    </div>
                    <div
                      className="relative border-b border-border"
                      style={{
                        width: gridW,
                        backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${COL_W - 1}px, var(--border) ${COL_W - 1}px ${COL_W}px)`,
                      }}
                    >
                      <div
                        className="absolute inset-y-0 bg-accent/50"
                        style={{ left: todayIdx * COL_W, width: COL_W }}
                      />
                      {bookings
                        .filter((b) => b.roomId === room.id && b.status !== 'cancelled')
                        .map((b) => (
                          <Bar key={b.id} booking={b} start={start} gridW={gridW} />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
      <Legend />
    </div>
  )
}

function Bar({ booking, start, gridW }: { booking: BookingVM; start: DateStr; gridW: number }) {
  const status = booking.status
  if (status === 'cancelled') return null

  const x0 = daysBetween(start, booking.checkIn) * COL_W + COL_W / 2
  const x1 = daysBetween(start, booking.checkOut) * COL_W + COL_W / 2
  const left = Math.max(0, x0)
  const right = Math.min(gridW, x1)
  const width = right - left - 4
  if (width <= 8) return null

  const name = booking.guest?.name ?? booking.bookingNo
  return (
    <Link
      to={`/bookings/${booking.id}`}
      title={`${name} · ${statusLabel(status)}`}
      className={cn(
        'absolute inset-y-1.5 flex items-center truncate rounded-md px-2 text-xs font-medium shadow-sm',
        barStyles[status],
      )}
      style={{ left: left + 2, width }}
    >
      {name.split(' ')[0]}
    </Link>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
      {(Object.keys(barStyles) as DrawnStatus[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm', barStyles[s].split(' ')[0])} />
          {statusLabel(s)}
        </span>
      ))}
    </div>
  )
}
