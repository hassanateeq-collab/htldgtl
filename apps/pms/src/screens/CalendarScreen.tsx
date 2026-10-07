import { useMemo, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPKR, t, type BookingStatus } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/feedback'
import { Page, PageHeader, SectionTitle } from '@/components/patterns/Page'
import { BookingRow, HkBadge } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useBookingsInRange } from '@/data/bookings'
import { useRooms, useRoomTypes } from '@/data/rooms'
import { OCCUPYING_STATUSES, type BookingVM, type RoomVM } from '@/data/types'
import { addDaysStr, daysBetween, fmtDay, fmtDayNum, fmtMedium, fmtShort, isDateStr, isNightCovered, type DateStr } from '@/lib/clock'
import { statusLabel } from '@/lib/labels'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'

// Tape-chart geometry. Bars start and end mid-cell so a same-day
// check-out / check-in in one room never visually overlaps.
const COL_W = 60
const LABEL_W = 76
const ROW_H = 48

type DrawnStatus = Exclude<BookingStatus, 'cancelled'>
const barClass: Record<DrawnStatus, string> = {
  confirmed: 'bg-status-confirmed text-white',
  checked_in: 'bg-status-inhouse text-white',
  checked_out: 'bg-status-departed text-status-departed-fg',
  no_show: 'striped bg-status-noshow-bg text-status-noshow-fg',
}

export default function CalendarScreen() {
  const navigate = useNavigate()
  const { can } = useTenant()
  const today = useHotelToday()
  const desktop = useIsDesktop()
  const days = desktop ? 28 : 14
  const lead = desktop ? 2 : 1
  const [start, setStart] = useState<DateStr>(() => addDaysStr(today, -lead))
  const [showNoShows, setShowNoShows] = useState(false)
  const [dayOpen, setDayOpen] = useState<DateStr | null>(null)

  const end = addDaysStr(start, days)
  const roomTypesQ = useRoomTypes()
  const roomsQ = useRooms()
  const bookingsQ = useBookingsInRange(start, end)

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDaysStr(start, i)), [start, days])
  const rooms = useMemo(() => (roomsQ.data ?? []).filter((r) => r.isActive), [roomsQ.data])
  const roomTypes = roomTypesQ.data ?? []
  const bookings = useMemo(() => (bookingsQ.data ?? []).filter((b) => showNoShows || b.status !== 'no_show'), [bookingsQ.data, showNoShows])
  const byRoom = useMemo(() => {
    const m = new Map<string, BookingVM[]>()
    for (const b of bookings) if (b.room) m.set(b.room.id, [...(m.get(b.room.id) ?? []), b])
    return m
  }, [bookings])
  const occupiedOn = useMemo(() => {
    const m = new Map<DateStr, number>()
    for (const d of dates) m.set(d, bookings.filter((b) => OCCUPYING_STATUSES.has(b.status) && isNightCovered(b.checkIn, b.checkOut, d)).length)
    return m
  }, [bookings, dates])

  const gridW = days * COL_W
  const todayIdx = daysBetween(start, today)
  const canWrite = can('bookings.create')
  const sellable = rooms.filter((r) => r.housekeepingStatus !== 'out_of_order').length

  function onRowClick(e: MouseEvent<HTMLDivElement>, room: RoomVM) {
    if (!canWrite || room.housekeepingStatus === 'out_of_order') return
    if ((e.target as HTMLElement).closest('a')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const idx = Math.floor((e.clientX - rect.left) / COL_W)
    const date = dates[idx]
    if (!date || date < today) return
    navigate(`/bookings/new?room=${room.id}&checkIn=${date}`)
  }

  const dayBookings = dayOpen ? bookings.filter((b) => b.checkIn === dayOpen || b.checkOut === dayOpen) : []

  return (
    <Page width="full" className="flex h-[calc(100svh-var(--topbar-h)-var(--tabbar-h))] flex-col !space-y-3 !px-0 !pb-0 md:h-svh md:!px-0 md:!py-4">
      <div className="px-4 md:px-6">
        <PageHeader title={t('cal.title')} subtitle={`${fmtShort(dates[0]!)} – ${fmtShort(dates[dates.length - 1]!)}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6">
        <Button variant="outline" size="icon" aria-label={t('cal.prev')} onClick={() => setStart(addDaysStr(start, -7))}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => setStart(addDaysStr(today, -lead))}>
          {t('cal.today')}
        </Button>
        <Button variant="outline" size="icon" aria-label={t('cal.next')} onClick={() => setStart(addDaysStr(start, 7))}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
        <input
          type="date"
          aria-label={t('cal.jump')}
          className="h-touch rounded-md border border-input bg-card px-3 text-base"
          value={addDaysStr(start, lead)}
          onChange={(e) => isDateStr(e.target.value) && setStart(addDaysStr(e.target.value, -lead))}
        />
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShowNoShows((v) => !v)}>
          {showNoShows ? t('cal.hideNoShows') : t('cal.showNoShows')}
        </Button>
        {canWrite && <span className="hidden text-xs text-muted-foreground lg:inline">{t('cal.hint')}</span>}
      </div>

      <QueryState
        pending={roomTypesQ.isPending || roomsQ.isPending || bookingsQ.isPending}
        error={roomTypesQ.error ?? roomsQ.error ?? bookingsQ.error}
        onRetry={() => void bookingsQ.refetch()}
        skeleton={<Skeleton className="mx-4 h-96 md:mx-6" />}
      >
        <div className="min-h-0 flex-1 overflow-auto border-t border-border">
          <div style={{ width: LABEL_W + gridW }}>
            {/* date header */}
            <div className="sticky top-0 z-20 flex bg-background">
              <div className="sticky left-0 z-30 shrink-0 border-b border-r border-border bg-background" style={{ width: LABEL_W }} />
              {dates.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setDayOpen(d)}
                  className={cn('shrink-0 border-b border-l border-border py-1.5 text-center hover:bg-accent', d === today && 'bg-accent')}
                  style={{ width: COL_W }}
                  aria-label={fmtMedium(d)}
                >
                  <div className="text-[11px] uppercase text-muted-foreground">{fmtDay(d)}</div>
                  <div className={cn('tnum text-base font-semibold leading-tight', d === today && 'text-primary')}>{fmtDayNum(d)}</div>
                  <div className="tnum text-[11px] text-muted-foreground">
                    {occupiedOn.get(d)}/{sellable}
                  </div>
                </button>
              ))}
            </div>

            {roomTypes.map((rt) => {
              const typeRooms = rooms.filter((r) => r.roomTypeId === rt.id)
              if (typeRooms.length === 0) return null
              return (
                <div key={rt.id}>
                  <div className="flex">
                    <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground" style={{ width: LABEL_W }}>
                      {rt.name}
                    </div>
                    <div className="bg-muted/60" style={{ width: gridW, height: 26 }} />
                  </div>
                  {typeRooms.map((room) => (
                    <div key={room.id} className="flex" style={{ height: ROW_H }}>
                      <div
                        className={cn('sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-b border-r border-border bg-background px-2', room.housekeepingStatus === 'out_of_order' && 'striped text-hk-ooo')}
                        style={{ width: LABEL_W }}
                        title={room.housekeepingStatus}
                      >
                        <span
                          className={cn(
                            'h-2.5 w-2.5 shrink-0 rounded-full',
                            room.housekeepingStatus === 'clean' && 'bg-hk-clean',
                            room.housekeepingStatus === 'inspected' && 'bg-hk-inspected',
                            room.housekeepingStatus === 'dirty' && 'bg-hk-dirty',
                            room.housekeepingStatus === 'out_of_order' && 'bg-hk-ooo',
                          )}
                          aria-hidden
                        />
                        <span className="tnum text-base font-medium">{room.label}</span>
                      </div>
                      <div
                        className={cn('relative border-b border-border', canWrite && room.housekeepingStatus !== 'out_of_order' && 'cursor-pointer')}
                        style={{
                          width: gridW,
                          backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${COL_W - 1}px, var(--border) ${COL_W - 1}px ${COL_W}px)`,
                        }}
                        onClick={(e) => onRowClick(e, room)}
                      >
                        {todayIdx >= 0 && todayIdx < days && <div className="pointer-events-none absolute inset-y-0 bg-accent/60" style={{ left: todayIdx * COL_W, width: COL_W }} />}
                        {(byRoom.get(room.id) ?? []).map((b) => (
                          <Bar key={b.id} booking={b} start={start} gridW={gridW} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </QueryState>

      <Legend />

      {dayOpen && (
        <Sheet open onOpenChange={(o) => !o && setDayOpen(null)} title={fmtMedium(dayOpen)} size="lg">
          <div className="space-y-4">
            <section className="space-y-2">
              <SectionTitle count={dayBookings.filter((b) => b.checkIn === dayOpen).length}>{t('today.arrivals')}</SectionTitle>
              {dayBookings
                .filter((b) => b.checkIn === dayOpen)
                .map((b) => (
                  <BookingRow key={b.id} booking={b} today={today} />
                ))}
            </section>
            <section className="space-y-2">
              <SectionTitle count={dayBookings.filter((b) => b.checkOut === dayOpen).length}>{t('today.departures')}</SectionTitle>
              {dayBookings
                .filter((b) => b.checkOut === dayOpen)
                .map((b) => (
                  <BookingRow key={b.id} booking={b} today={today} />
                ))}
            </section>
          </div>
        </Sheet>
      )}
    </Page>
  )
}

function Bar({ booking: b, start, gridW }: { booking: BookingVM; start: DateStr; gridW: number }) {
  if (b.status === 'cancelled') return null
  const x0 = daysBetween(start, b.checkIn) * COL_W + COL_W / 2
  const x1 = daysBetween(start, b.checkOut) * COL_W + COL_W / 2
  const left = Math.max(0, x0)
  const right = Math.min(gridW, x1)
  const width = right - left - 4
  if (width <= 8) return null
  const due = (b.folio?.balance ?? 0) > 0 && b.status !== 'no_show'
  const title = `${b.guest.name} · ${statusLabel(b.status)}${due ? ` · ${t('bookings.due', { amount: formatPKR(b.folio!.balance) })}` : ''}`
  return (
    <Link
      to={`/bookings/${b.id}`}
      title={title}
      aria-label={title}
      className={cn('absolute inset-y-1 flex items-center gap-1 truncate rounded-md px-2 text-xs font-medium shadow-sm', barClass[b.status as DrawnStatus])}
      style={{ left: left + 2, width }}
    >
      <span className="truncate">{b.guest.name.split(' ')[0]}</span>
      {due && <span className="h-2 w-2 shrink-0 rounded-full bg-white ring-2 ring-due" aria-hidden />}
    </Link>
  )
}

function Legend() {
  const items: { cls: string; label: string }[] = [
    { cls: 'bg-status-confirmed', label: statusLabel('confirmed') },
    { cls: 'bg-status-inhouse', label: statusLabel('checked_in') },
    { cls: 'bg-status-departed', label: statusLabel('checked_out') },
    { cls: 'striped bg-status-noshow-bg text-status-noshow-fg', label: statusLabel('no_show') },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 pr-20 text-xs text-muted-foreground md:px-6 md:pr-6">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn('h-3 w-3 rounded-sm', i.cls)} aria-hidden /> {i.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-white ring-2 ring-due" aria-hidden /> {t('cal.legendDue')}
      </span>
      <span className="ml-auto hidden items-center gap-2 md:inline-flex">
        <HkBadge status="clean" /> <HkBadge status="dirty" /> <HkBadge status="out_of_order" />
      </span>
    </div>
  )
}
