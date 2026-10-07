import { useState } from 'react'
import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/feedback'
import { HkBadge } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useUpdateBooking } from '@/data/bookings'
import { sortByReadiness, useAvailability } from '@/data/availability'
import type { BookingVM } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

interface Props {
  booking: BookingVM
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Move a stay to another free room (same dates and rate), clean rooms first. */
export function MoveRoomSheet({ booking: b, open, onOpenChange }: Props) {
  const { rooms, roomTypes, pending, error } = useAvailability(b.checkIn, b.checkOut, b.id)
  const update = useUpdateBooking()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const target = rooms.find((r) => r.id === roomId)

  async function confirm() {
    if (!target) return
    setErr(null)
    try {
      await update.mutateAsync({
        bookingId: b.id,
        roomId: target.id,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        adults: b.adults,
        children: b.children,
        source: b.source,
        nightlyRate: b.nightlyRatePkr,
        notes: b.notes,
      })
      toast.success(t('toast.moved', { room: target.label }))
      onOpenChange(false)
    } catch (e) {
      setErr(errorMessage(e))
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('actions.moveRoom')}
      description={b.room ? `${t('booking.room')} ${b.room.label} → …` : undefined}
      busy={update.isPending}
      footer={
        <Button className="w-full" size="lg" onClick={() => void confirm()} loading={update.isPending} disabled={!target}>
          {target ? t('toast.moved', { room: target.label }) : t('actions.moveRoom')}
        </Button>
      }
    >
      <QueryState pending={pending} error={error}>
        <div className="space-y-4">
          {roomTypes.map((rt) => {
            const options = sortByReadiness(rooms.filter((r) => r.roomTypeId === rt.id && r.free && r.id !== b.room?.id))
            if (options.length === 0) return null
            return (
              <section key={rt.id} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{rt.name}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {options.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoomId(r.id)}
                      className={cn(
                        'flex min-h-touch items-center justify-between rounded-lg border px-3 py-2 text-left',
                        roomId === r.id ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-accent/60',
                      )}
                      aria-pressed={roomId === r.id}
                    >
                      <span className="tnum text-base font-semibold">{r.label}</span>
                      <HkBadge status={r.housekeepingStatus} />
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          {rooms.filter((r) => r.free && r.id !== b.room?.id).length === 0 && <p className="text-sm text-muted-foreground">{t('new.noRooms')}</p>}
          {err && (
            <p role="alert" className="text-sm font-medium text-due">
              {err}
            </p>
          )}
        </div>
      </QueryState>
    </Sheet>
  )
}
