import { formatPKR, t } from '@hotel-digital/shared'
import { hkLabel } from '@/lib/labels'
import {
  sampleProperty,
  sampleRoomTypes,
  sampleRooms,
  type HousekeepingStatus,
} from '@/mock/sample-property'

const hkDot: Record<HousekeepingStatus, string> = {
  clean: 'bg-green-500',
  dirty: 'bg-amber-500',
  inspected: 'bg-blue-500',
  out_of_order: 'bg-red-500',
}

export function RoomsScreen() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-4 pb-24">
      <section className="grid grid-cols-3 gap-2">
        <Stat label={t('rooms.roomTypes')} value={String(sampleRoomTypes.length)} />
        <Stat label={t('rooms.rooms')} value={String(sampleRooms.length)} />
        <Stat label={t('rooms.class')} value={t('rooms.star', { n: sampleProperty.starRating })} />
      </section>

      <p className="text-xs text-muted-foreground">
        {t('rooms.checkInFrom', { time: sampleProperty.checkInFrom })} ·{' '}
        {t('rooms.checkOutBy', { time: sampleProperty.checkOutUntil })} · {sampleProperty.currency}
      </p>

      {sampleRoomTypes.map((rt) => {
        const rooms = sampleRooms.filter((r) => r.roomTypeId === rt.id)
        return (
          <section
            key={rt.id}
            className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{rt.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {rt.bedConfig} · {rt.sizeSqm} m² · {t('rooms.sleeps', { n: rt.maxOccupancy })}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{formatPKR(rt.baseRatePkr)}</p>
                <p className="text-xs text-muted-foreground">{t('rooms.perNight')}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {rooms.map((room) => (
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
