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

  'auth.hotelCode': 'Hotel code',
  'auth.hotelCodeHint': 'The short code in your login link, for example: paramount',
  'auth.continue': 'Continue',
  'auth.signInTo': 'Sign in to {name}',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signIn': 'Sign in',
  'auth.signingIn': 'Signing in…',
  'auth.signOut': 'Sign out',
  'auth.switchHotel': 'Switch hotel',
  'auth.chooseHotel': 'Choose a hotel',
  'auth.noMemberships': 'Your account is not a member of any hotel yet.',
  'auth.invalid': 'Email or password is incorrect.',
  'auth.noAccess': 'Your account does not have access to this hotel.',
  'auth.signedInAs': 'Signed in as {email}',

  'role.owner': 'Owner',
  'role.manager': 'Manager',
  'role.front_desk': 'Front desk',
  'role.housekeeping': 'Housekeeping',
  'role.accounts': 'Accounts',
  'role.read_only': 'Read-only',

  'shell.readOnly': 'Read-only: subscription payment is overdue. Staff can view but not change data.',
  'shell.suspended': 'This hotel\'s subscription is suspended. Please contact Hamsun to restore access.',

  'rooms.availableTonight': 'Free tonight',

  'actions.checkIn': 'Check in',
  'actions.checkOut': 'Check out',
  'actions.noShow': 'Mark no-show',
  'actions.cancel': 'Cancel booking',
  'actions.tapAgain': 'Tap again to confirm',
  'actions.working': 'Working…',
  'actions.newBooking': 'New booking',

  'folio.addPayment': 'Add payment',
  'folio.addCharge': 'Add charge',
  'folio.amount': 'Amount (PKR)',
  'folio.method': 'Method',
  'folio.reference': 'Reference (optional)',
  'folio.description': 'Description',
  'folio.save': 'Save',
  'folio.cancel': 'Cancel',
  'folio.closed': 'Folio closed',

  'new.title': 'New booking',
  'new.guest': 'Guest',
  'new.guestName': 'Guest name',
  'new.guestPhone': 'Phone',
  'new.usingGuest': 'Returning guest: {name}',
  'new.change': 'Change',
  'new.searchHint': 'Start typing to find a returning guest',
  'new.stay': 'Stay',
  'new.checkIn': 'Check-in',
  'new.checkOut': 'Check-out',
  'new.roomType': 'Room type',
  'new.room': 'Room',
  'new.noRooms': 'No free rooms of this type for these dates.',
  'new.adults': 'Adults',
  'new.source': 'Source',
  'new.rate': 'Rate per night (PKR)',
  'new.total': '{nights} × {rate} = {total}',
  'new.notes': 'Notes',
  'new.create': 'Create booking',
  'new.creating': 'Creating…',
  'new.nameRequired': 'Enter the guest\'s name.',
  'new.badDates': 'Check-out must be after check-in.',

  'error.room_taken': 'That room is no longer free for these dates. Pick another room.',
  'error.balance_due': 'There is a balance due. Settle the folio before check-out.',
  'error.forbidden': 'You do not have permission to do that.',
  'error.bad_transition': 'That action is not available for this booking.',
  'error.unknown': 'Something went wrong. Please try again.',

  'nav.guests': 'Guests',

  'cal.prev': 'Previous week',
  'cal.next': 'Next week',
  'cal.today': 'Today',
  'cal.jump': 'Go to date',
  'cal.hint': 'Tap an empty cell to start a booking for that room and night.',

  'bookings.outstanding': 'Balance due',
  'bookings.due': 'Due {amount}',
  'bookings.totalDue': 'Total due {amount}',

  'booking.edit': 'Edit',
  'booking.receipt': 'Receipt',
  'booking.viewGuest': 'View guest',

  'edit.title': 'Edit booking',
  'edit.save': 'Save changes',
  'edit.saving': 'Saving…',
  'edit.checkInLocked': 'Check-in cannot change while the guest is in-house.',

  'new.deposit': 'Advance payment (optional)',
  'new.depositAmount': 'Amount (PKR)',
  'new.depositMethod': 'Method',

  'folio.add': 'Add to folio',
  'folio.kind': 'Type',
  'kind.charge': 'Charge',
  'kind.payment': 'Payment',
  'kind.discount': 'Discount',
  'kind.refund': 'Refund',

  'receipt.title': 'Receipt',
  'receipt.print': 'Print',
  'receipt.back': 'Back to booking',
  'receipt.bookingNo': 'Booking',
  'receipt.issued': 'Issued',
  'receipt.guest': 'Guest',
  'receipt.stay': 'Stay',
  'receipt.date': 'Date',
  'receipt.description': 'Description',
  'receipt.charges': 'Charges',
  'receipt.payments': 'Payments',
  'receipt.totalCharges': 'Total charges',
  'receipt.totalPaid': 'Total paid',
  'receipt.balance': 'Balance due',
  'receipt.paid': 'PAID',
  'receipt.thanks': 'Thank you for staying with us.',
  'receipt.ntn': 'NTN',
  'receipt.strn': 'STRN',

  'guests.search': 'Search by name or phone',
  'guests.stays': '{n} stays',
  'guests.stay': '1 stay',
  'guests.lastStay': 'Last stay {date}',
  'guests.empty': 'No guests found.',
  'guests.edit': 'Edit details',
  'guests.save': 'Save',
  'guests.cancel': 'Cancel',
  'guests.name': 'Name',
  'guests.phone': 'Phone',
  'guests.email': 'Email',
  'guests.nationality': 'Nationality',
  'guests.cnic': 'CNIC',
  'guests.passport': 'Passport',
  'guests.history': 'Booking history',
  'guests.totalDue': 'Total balance due',
  'guests.notFound': 'Guest not found.',

  'common.loading': 'Loading…',
  'common.error': 'Something went wrong.',
  'common.retry': 'Retry',
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
