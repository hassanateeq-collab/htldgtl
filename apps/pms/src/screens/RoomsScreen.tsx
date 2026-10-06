import { formatPKR, t, type HousekeepingStatus } from '@hotel-digital/shared'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useRooms, useRoomTypes } from '@/data/queries'
import { OCCUPYING_STATUSES } from '@/data/types'
import { isNightCovered, todayStr } from '@/lib/dates'
import { hkLabel } from '@/lib/labels'

const hkDot: Record<HousekeepingStatus, string> = {
  clean: 'bg-green-500',
  dirty: 'bg-amber-500',
  inspected: 'bg-blue-500',
  out_of_order: 'bg-red-500',
}

export function RoomsScreen() {
  const { property } = useTenant()
  const roomTypesQ = useRoomTypes(property.id)
  const roomsQ = useRooms(property.id)
  const bookingsQ = useBookings(property.id)

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
  const today = todayStr()
  const occupiedTonight = new Set(
    bookings
      .filter((b) => OCCUPYING_STATUSES.has(b.status) && isNightCovered(b.checkIn, b.checkOut, today))
      .map((b) => b.roomId),
  ).size
  const freeTonight = Math.max(rooms.length - occupiedTonight, 0)

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-4 pb-24">
      <section className="grid grid-cols-3 gap-2">
        <Stat label={t('rooms.roomTypes')} value={String(roomTypes.length)} />
        <Stat label={t('rooms.rooms')} value={String(rooms.length)} />
        <Stat label={t('rooms.availableTonight')} value={String(freeTonight)} />
      </section>

      <p className="text-xs text-muted-foreground">
        {property.name}
        {property.city ? ` · ${property.city}` : ''} · {property.currency}
      </p>

      {roomTypes.map((rt) => {
        const typeRooms = rooms.filter((r) => r.roomTypeId === rt.id)
        return (
          <section
            key={rt.id}
            className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{rt.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {[rt.bedConfig, rt.sizeSqm ? `${rt.sizeSqm} m²` : null, t('rooms.sleeps', { n: rt.maxOccupancy })]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{formatPKR(rt.baseRatePkr)}</p>
                <p className="text-xs text-muted-foreground">{t('rooms.perNight')}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {typeRooms.map((room) => (
                <span
                  key={room.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
                  title={hkLabel(room.housekeepingStatus)}
                >
                  <span className={`h-2 w-2 rounded-full ${hkDot[room.housekeepingStatus]}`} />
                  {room.label}
                </span>
              ))}
            </div>
          </section>
        )
      })}

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1 text-xs text-muted-foreground">
        {(Object.keys(hkDot) as HousekeepingStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${hkDot[s]}`} /> {hkLabel(s)}
          </span>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center text-card-foreground">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
