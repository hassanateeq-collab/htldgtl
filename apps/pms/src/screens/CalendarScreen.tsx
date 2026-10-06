import { Link } from 'react-router-dom'
import type { BookingStatus } from '@hotel-digital/shared'
import { cn } from '@/lib/utils'
import { addDaysStr, daysBetween, fmtDay, fmtDayNum, type DateStr } from '@/lib/dates'
import { statusLabel } from '@/lib/labels'
import { sampleRoomTypes, sampleRooms } from '@/mock/sample-property'
import {
  TODAY,
  bookingsForRoom,
  guestById,
  occupiedOnNight,
  type SampleBooking,
} from '@/mock/sample-bookings'

// Tape chart geometry. Bars start and end mid-cell so a same-day
// check-out / check-in in one room never visually overlaps.
const COL_W = 56
const LABEL_W = 60
const ROW_H = 44
const DAYS = 14
const START: DateStr = addDaysStr(TODAY, -2)
const DATES: DateStr[] = Array.from({ length: DAYS }, (_, i) => addDaysStr(START, i))
const GRID_W = DAYS * COL_W
const TODAY_IDX = daysBetween(START, TODAY)

type DrawnStatus = Exclude<BookingStatus, 'cancelled'>
const barStyles: Record<DrawnStatus, string> = {
  confirmed: 'bg-blue-500 text-white',
  checked_in: 'bg-green-600 text-white',
  checked_out: 'bg-zinc-300 text-zinc-700',
  no_show: 'bg-red-400 text-white',
}

export function CalendarScreen() {
  const totalRooms = sampleRooms.length

  return (
    <div className="flex h-[calc(100svh-7rem)] flex-col">
      <div className="flex-1 overflow-auto">
        <div style={{ width: LABEL_W + GRID_W }}>
          {/* Date header */}
          <div className="sticky top-0 z-20 flex bg-background">
            <div
              className="sticky left-0 z-30 shrink-0 border-b border-r border-border bg-background"
              style={{ width: LABEL_W }}
            />
            {DATES.map((ds) => (
              <div
                key={ds}
                className={cn(
                  'shrink-0 border-b border-l border-border py-1 text-center',
                  ds === TODAY && 'bg-accent',
                )}
                style={{ width: COL_W }}
              >
                <div className="text-[10px] uppercase text-muted-foreground">{fmtDay(ds)}</div>
                <div className="text-sm font-semibold leading-tight">{fmtDayNum(ds)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {occupiedOnNight(ds).length}/{totalRooms}
                </div>
              </div>
            ))}
          </div>

          {/* Rooms grouped by type */}
          {sampleRoomTypes.map((rt) => (
            <div key={rt.id}>
              <div className="flex">
                <div
                  className="sticky left-0 z-10 shrink-0 border-r border-border bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
                  style={{ width: LABEL_W }}
                >
                  {rt.name}
                </div>
                <div className="bg-muted/60" style={{ width: GRID_W, height: 24 }} />
              </div>

              {sampleRooms
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
                        width: GRID_W,
                        backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${COL_W - 1}px, var(--border) ${COL_W - 1}px ${COL_W}px)`,
                      }}
                    >
                      <div
                        className="absolute inset-y-0 bg-accent/50"
                        style={{ left: TODAY_IDX * COL_W, width: COL_W }}
                      />
                      {bookingsForRoom(room.id).map((bk) => (
                        <Bar key={bk.id} booking={bk} />
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

function Bar({ booking }: { booking: SampleBooking }) {
  const status = booking.status
  if (status === 'cancelled') return null

  const x0 = daysBetween(START, booking.checkIn) * COL_W + COL_W / 2
  const x1 = daysBetween(START, booking.checkOut) * COL_W + COL_W / 2
  const left = Math.max(0, x0)
  const right = Math.min(GRID_W, x1)
  const width = right - left - 4
  if (width <= 8) return null

  const guest = guestById(booking.guestId)
  return (
    <Link
      to={`/bookings/${booking.id}`}
      title={`${guest?.name ?? ''} · ${statusLabel(status)}`}
      className={cn(
        'absolute inset-y-1.5 flex items-center truncate rounded-md px-2 text-xs font-medium shadow-sm',
        barStyles[status],
      )}
      style={{ left: left + 2, width }}
    >
      {guest?.name.split(' ')[0]}
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
