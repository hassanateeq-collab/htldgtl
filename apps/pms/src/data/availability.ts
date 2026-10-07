// Free-room filter for the booking forms. Mirrors the database's EXCLUDE
// predicate (anything not cancelled / no-show blocks its nights); the
// constraint remains the race-safe guard. Also flags readiness so staff can
// prefer clean rooms and never pick an out-of-order one.
import { useMemo } from 'react'
import type { DateStr } from '@/lib/clock'
import { useBookingsInRange } from './bookings'
import { useRooms, useRoomTypes } from './rooms'
import { OCCUPYING_STATUSES, type RoomVM } from './types'

export interface RoomAvailability extends RoomVM {
  free: boolean
  /** Occupied by this booking id when not free. */
  blockedBy: string | null
}

export function useAvailability(checkIn: DateStr, checkOut: DateStr, excludeBookingId?: string) {
  const roomsQ = useRooms()
  const typesQ = useRoomTypes()
  const valid = Boolean(checkIn && checkOut && checkIn < checkOut)
  const rangeQ = useBookingsInRange(valid ? checkIn : checkIn || '1970-01-01', valid ? checkOut : checkIn || '1970-01-02')

  const rooms = useMemo<RoomAvailability[]>(() => {
    const busy = new Map<string, string>()
    for (const b of rangeQ.data ?? []) {
      if (b.id === excludeBookingId || !b.room || !OCCUPYING_STATUSES.has(b.status)) continue
      if (b.checkIn < checkOut && checkIn < b.checkOut) busy.set(b.room.id, b.id)
    }
    return (roomsQ.data ?? [])
      .filter((r) => r.isActive)
      .map((r) => ({ ...r, free: !busy.has(r.id) && r.housekeepingStatus !== 'out_of_order', blockedBy: busy.get(r.id) ?? null }))
  }, [rangeQ.data, roomsQ.data, checkIn, checkOut, excludeBookingId])

  return {
    rooms,
    roomTypes: typesQ.data ?? [],
    pending: roomsQ.isPending || typesQ.isPending || (valid && rangeQ.isPending),
    error: roomsQ.error ?? typesQ.error ?? rangeQ.error,
  }
}

/** Clean/inspected first, then dirty; out-of-order never. */
export function sortByReadiness(rooms: RoomAvailability[]): RoomAvailability[] {
  const rank = { inspected: 0, clean: 1, dirty: 2, out_of_order: 3 } as const
  return [...rooms].sort((a, b) => rank[a.housekeepingStatus] - rank[b.housekeepingStatus] || a.label.localeCompare(b.label, undefined, { numeric: true }))
}
