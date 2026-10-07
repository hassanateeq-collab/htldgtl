// Query keys, scoped by tenant and property so switching hotels can never show
// another hotel's cached data, and invalidation stays targeted.
export type Scope = { tenantId: string; propertyId: string }

const root = (s: Scope) => ['t', s.tenantId, 'p', s.propertyId] as const

export const keys = {
  all: (s: Scope) => root(s),
  roomTypes: (s: Scope) => [...root(s), 'room-types'] as const,
  rooms: (s: Scope) => [...root(s), 'rooms'] as const,
  roomsBoard: (s: Scope) => [...root(s), 'rooms-board'] as const,
  roomHistory: (s: Scope, roomId: string) => [...root(s), 'room-history', roomId] as const,
  bookings: (s: Scope) => [...root(s), 'bookings'] as const,
  bookingsRange: (s: Scope, from: string, to: string) => [...root(s), 'bookings', 'range', from, to] as const,
  bookingsToday: (s: Scope, today: string) => [...root(s), 'bookings', 'today', today] as const,
  bookingsList: (s: Scope, filter: string, q: string, today: string) =>
    [...root(s), 'bookings', 'list', filter, q, today] as const,
  booking: (s: Scope, id: string) => [...root(s), 'bookings', 'one', id] as const,
  bookingsOfGuest: (s: Scope, guestId: string) => [...root(s), 'bookings', 'guest', guestId] as const,
  folio: (s: Scope, bookingId: string) => [...root(s), 'folio', bookingId] as const,
  guests: (s: Scope) => [...root(s), 'guests'] as const,
  guestsList: (s: Scope, q: string) => [...root(s), 'guests', 'list', q] as const,
  guest: (s: Scope, id: string) => [...root(s), 'guests', 'one', id] as const,
  guestLookup: (s: Scope, q: string) => [...root(s), 'guests', 'lookup', q] as const,
  cash: (s: Scope) => [...root(s), 'cash'] as const,
  cashCurrent: (s: Scope) => [...root(s), 'cash', 'current'] as const,
  cashHistory: (s: Scope) => [...root(s), 'cash', 'history'] as const,
  report: (s: Scope, date: string) => [...root(s), 'report', date] as const,
  members: (s: Scope) => [...root(s), 'members'] as const,
  activity: (s: Scope, bookingId: string) => [...root(s), 'activity', bookingId] as const,
}
