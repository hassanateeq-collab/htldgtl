// Minimal i18n layer: English now, Urdu keys ready. Both apps import `t`.
// Every UI string goes through here (CLAUDE.md). Interpolate with {name}.

export const en = {
  'nav.today': 'Today',
  'nav.calendar': 'Calendar',
  'nav.bookings': 'Bookings',
  'nav.rooms': 'Rooms',
  'nav.more': 'More',

  'today.arrivals': 'Arrivals',
  'today.departures': 'Departures',
  'today.inHouse': 'In-house',
  'today.occupancy': 'Occupancy',
  'today.cashToday': 'Cash collected today',
  'today.arrivalsToday': 'Arriving today',
  'today.departuresToday': 'Departing today',
  'today.inHouseNow': 'In-house tonight',
  'today.none': 'None',

  'bookings.current': 'Current and upcoming',
  'bookings.past': 'Past',
  'bookings.empty': 'No bookings',

  'booking.guest': 'Guest',
  'booking.stay': 'Stay',
  'booking.room': 'Room',
  'booking.dates': 'Dates',
  'booking.nights': 'Nights',
  'booking.rate': 'Rate per night',
  'booking.adults': 'Adults',
  'booking.notes': 'Notes',
  'booking.folio': 'Folio',
  'booking.roomCharges': 'Room charges',
  'booking.payments': 'Payments',
  'booking.balance': 'Balance due',
  'booking.settled': 'Settled',
  'booking.notFound': 'Booking not found',

  'rooms.roomTypes': 'Room types',
  'rooms.rooms': 'Rooms',
  'rooms.class': 'Class',
  'rooms.star': '{n}-star',
  'rooms.checkInFrom': 'Check-in {time}',
  'rooms.checkOutBy': 'Check-out by {time}',
  'rooms.perNight': 'per night',
  'rooms.sleeps': 'sleeps {n}',

  'more.guests': 'Guests',
  'more.housekeeping': 'Housekeeping',
  'more.reports': 'Daily report',
  'more.cashHandover': 'Cash handover',
  'more.settings': 'Settings',
  'more.comingSoon': 'Coming soon',

  'status.confirmed': 'Confirmed',
  'status.checked_in': 'Checked in',
  'status.checked_out': 'Checked out',
  'status.cancelled': 'Cancelled',
  'status.no_show': 'No-show',

  'source.walk_in': 'Walk-in',
  'source.phone': 'Phone',
  'source.whatsapp': 'WhatsApp',
  'source.ota': 'OTA',
  'source.direct': 'Direct',

  'method.bank_transfer': 'Bank transfer',
  'method.raast': 'Raast',
  'method.jazzcash': 'JazzCash',
  'method.easypaisa': 'Easypaisa',
  'method.cash': 'Cash',

  'hk.clean': 'Clean',
  'hk.dirty': 'Dirty',
  'hk.inspected': 'Inspected',
  'hk.out_of_order': 'Out of order',

  'common.back': 'Back',
  'common.night': '{n} night',
  'common.nights': '{n} nights',
  'common.of': '{a} of {b}',
} as const

export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>

let active: Messages = en

/** Swap the active message set (e.g. Urdu). All keys must be present. */
export function setMessages(messages: Messages): void {
  active = messages
}

/** Translate a key, interpolating {vars}. Falls back to the key itself. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template: string = active[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  )
}
