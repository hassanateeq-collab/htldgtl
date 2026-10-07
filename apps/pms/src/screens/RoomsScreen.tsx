import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn, Plus } from 'lucide-react'
import { formatPKR, HOUSEKEEPING_STATUSES, t, type HousekeepingStatus } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { EmptyState, Skeleton, toast } from '@/components/ui/feedback'
import { Page, PageHeader } from '@/components/patterns/Page'
import { HkBadge } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useRoomsBoard, useSetRoomStatus } from '@/data/rooms'
import type { RoomBoardVM } from '@/data/types'
import { fmtSmart } from '@/lib/clock'
import { errorMessage } from '@/lib/errors'
import { hkLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'free' | 'occupied' | 'dirty' | 'departing'

function roomState(r: RoomBoardVM, today: string) {
  const occupied = r.current !== null
  const departing = occupied && r.current!.checkOut <= today
  const arriving = !occupied && r.next?.checkIn === today
  return { occupied, departing, arriving }
}

export default function RoomsScreen() {
  const { can } = useTenant()
  const today = useHotelToday()
  const boardQ = useRoomsBoard()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<RoomBoardVM | null>(null)

  const rooms = useMemo(() => (boardQ.data ?? []).filter((r) => r.isActive), [boardQ.data])
  const counts = useMemo(() => {
    let free = 0
    let occupied = 0
    let dirty = 0
    let departing = 0
    for (const r of rooms) {
      const s = roomState(r, today)
      if (s.occupied) occupied++
      else if (r.housekeepingStatus !== 'out_of_order') free++
      if (r.housekeepingStatus === 'dirty') dirty++
      if (s.departing) departing++
    }
    return { free, occupied, dirty, departing }
  }, [rooms, today])

  const visible = rooms.filter((r) => {
    const s = roomState(r, today)
    switch (filter) {
      case 'free':
        return !s.occupied && r.housekeepingStatus !== 'out_of_order'
      case 'occupied':
        return s.occupied
      case 'dirty':
        return r.housekeepingStatus === 'dirty'
      case 'departing':
        return s.departing
      default:
        return true
    }
  })

  // keep the sheet's room fresh after a status change
  const selectedLive = selected ? (rooms.find((r) => r.id === selected.id) ?? selected) : null

  return (
    <Page width="xl">
      <PageHeader title={t('rooms.title')} subtitle={t('rooms.summary', { free: counts.free, occupied: counts.occupied, dirty: counts.dirty })} />
      <Segmented
        ariaLabel={t('rooms.title')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('rooms.filter.all'), meta: rooms.length },
          { value: 'free', label: t('rooms.filter.free'), meta: counts.free },
          { value: 'occupied', label: t('rooms.filter.occupied'), meta: counts.occupied },
          { value: 'departing', label: t('rooms.filter.departing'), meta: counts.departing },
          { value: 'dirty', label: t('rooms.filter.dirty'), meta: counts.dirty },
        ]}
      />

      <QueryState
        pending={boardQ.isPending}
        error={boardQ.error}
        onRetry={() => void boardQ.refetch()}
        skeleton={
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        }
      >
        {visible.length === 0 ? (
          <EmptyState title={t('rooms.empty')} />
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5">
            {visible.map((r) => (
              <RoomTile key={r.id} room={r} today={today} onClick={() => setSelected(r)} />
            ))}
          </div>
        )}
      </QueryState>

      {selectedLive && (
        <RoomSheet room={selectedLive} today={today} open onOpenChange={(o) => !o && setSelected(null)} canStatus={can('rooms.status')} canBook={can('bookings.create')} />
      )}
    </Page>
  )
}

function RoomTile({ room: r, today, onClick }: { room: RoomBoardVM; today: string; onClick: () => void }) {
  const { occupied, departing, arriving } = roomState(r, today)
  const ooo = r.housekeepingStatus === 'out_of_order'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-28 flex-col rounded-lg border p-3 text-left transition-colors hover:bg-accent/60 active:bg-accent',
        occupied ? 'border-status-inhouse/40 bg-card' : 'border-border bg-card',
        ooo && 'striped text-hk-ooo',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="tnum text-xl font-semibold leading-none">{r.label}</p>
        <HkBadge status={r.housekeepingStatus} className="shrink-0" />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{r.roomTypeName}</p>
      <div className="mt-auto pt-3 text-sm">
        {occupied && r.current ? (
          <>
            <p className="truncate font-medium">{r.current.guestName}</p>
            <p className="tnum truncate text-xs text-muted-foreground">
              {departing ? <span className="font-medium text-warning">{t('rooms.leavingToday')}</span> : t('rooms.until', { date: fmtSmart(r.current.checkOut, today) })}
            </p>
            {r.current.balance > 0 && <Badge tone="due" className="mt-1">{t('bookings.due', { amount: formatPKR(r.current.balance) })}</Badge>}
          </>
        ) : (
          <>
            <p className={cn('font-medium', ooo ? 'text-hk-ooo' : 'text-settled')}>{ooo ? hkLabel('out_of_order') : t('rooms.free')}</p>
            {r.next && (
              <p className="tnum truncate text-xs text-muted-foreground">
                {arriving ? <span className="font-medium text-status-confirmed-fg">{t('rooms.arrivingToday')} · {r.next.guestName}</span> : t('rooms.nextArrival', { name: r.next.guestName, date: fmtSmart(r.next.checkIn, today) })}
              </p>
            )}
          </>
        )}
      </div>
    </button>
  )
}

interface RoomSheetProps {
  room: RoomBoardVM
  today: string
  open: boolean
  onOpenChange: (open: boolean) => void
  canStatus: boolean
  canBook: boolean
}

function RoomSheet({ room: r, today, open, onOpenChange, canStatus, canBook }: RoomSheetProps) {
  const navigate = useNavigate()
  const setStatus = useSetRoomStatus()
  const { occupied } = roomState(r, today)

  async function change(status: HousekeepingStatus) {
    try {
      await setStatus.mutateAsync({ roomId: r.id, status })
      toast.success(t('hk.changed', { room: r.label, status: hkLabel(status).toLowerCase() }))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${t('booking.room')} ${r.label}`} description={r.roomTypeName}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('rooms.setStatus')}</span>
          <HkBadge status={r.housekeepingStatus} />
        </div>
        {canStatus && (
          <div className="grid grid-cols-2 gap-2">
            {HOUSEKEEPING_STATUSES.map((s) => (
              <Button key={s} variant={s === r.housekeepingStatus ? 'default' : 'outline'} disabled={setStatus.isPending || s === r.housekeepingStatus} onClick={() => void change(s)}>
                {t(`hk.mark.${s}`)}
              </Button>
            ))}
          </div>
        )}

        {r.current && (
          <section className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('rooms.occupied')}</p>
            <p className="mt-1 text-base font-medium">{r.current.guestName}</p>
            <p className="tnum text-sm text-muted-foreground">
              {fmtSmart(r.current.checkIn, today)} → {fmtSmart(r.current.checkOut, today)}
            </p>
            {r.current.balance > 0 && <Badge tone="due" className="mt-1">{t('bookings.due', { amount: formatPKR(r.current.balance) })}</Badge>}
            <Button variant="outline" className="mt-3 w-full" asChild>
              <Link to={`/bookings/${r.current.bookingId}`}>
                {t('rooms.openBooking')} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </section>
        )}

        {r.next && (
          <p className="text-sm text-muted-foreground">
            {t('rooms.nextArrival', { name: r.next.guestName, date: fmtSmart(r.next.checkIn, today) })}
          </p>
        )}

        {canBook && !occupied && r.housekeepingStatus !== 'out_of_order' && (
          <div className="grid grid-cols-1 gap-2">
            <Button size="lg" onClick={() => navigate(`/bookings/new?walkin=1&room=${r.id}`)}>
              <LogIn className="h-5 w-5" aria-hidden />
              {t('rooms.walkInHere')}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate(`/bookings/new?room=${r.id}`)}>
              <Plus className="h-5 w-5" aria-hidden />
              {t('rooms.bookHere')}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
