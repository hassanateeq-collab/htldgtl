/**
 * Sample guests, bookings and payments for the Central Residence demo property.
 * Dates are relative to "today" so the Today view and calendar always look live.
 * Replaced by real rows once the database is up.
 */
import type { BookingSource, BookingStatus, PaymentMethod } from '@hotel-digital/shared'
import { addDaysStr, isNightCovered, todayStr, type DateStr } from '@/lib/dates'
import {
  sampleProperty,
  sampleRoomTypes,
  sampleRooms,
  type SampleRoom,
  type SampleRoomType,
} from './sample-property'

export interface SampleGuest {
  id: string
  name: string
  phone: string // +92… canonical
  nationality: string
  email?: string
}

export interface SampleBooking {
  id: string
  bookingNo: string
  propertyId: string
  guestId: string
  roomId: string
  roomTypeId: string
  status: BookingStatus
  source: BookingSource
  checkIn: DateStr
  checkOut: DateStr
  adults: number
  nightlyRatePkr: number
  notes?: string
}

export interface SamplePayment {
  id: string
  bookingId: string
  amountPkr: number
  method: PaymentMethod
  receivedOn: DateStr
  reference?: string
}

export const TODAY: DateStr = todayStr()
const d = (offset: number): DateStr => addDaysStr(TODAY, offset)

export const sampleGuests: SampleGuest[] = [
  { id: 'g-01', name: 'Ahmed Raza', phone: '+923001234567', nationality: 'Pakistan' },
  { id: 'g-02', name: 'Fatima Khan', phone: '+923211234568', nationality: 'Pakistan' },
  { id: 'g-03', name: 'Bilal Siddiqui', phone: '+923331234569', nationality: 'Pakistan' },
  { id: 'g-04', name: 'Sara Malik', phone: '+923451234570', nationality: 'Pakistan', email: 'sara.malik@example.com' },
  { id: 'g-05', name: 'Omar Farooq', phone: '+923121234571', nationality: 'Pakistan' },
  { id: 'g-06', name: 'Ayesha Iqbal', phone: '+923041234572', nationality: 'Pakistan' },
  { id: 'g-07', name: 'James Carter', phone: '+447700900123', nationality: 'United Kingdom', email: 'james.carter@example.com' },
  { id: 'g-08', name: 'Noor Fatima', phone: '+923151234573', nationality: 'Pakistan' },
  { id: 'g-09', name: 'Hassan Ali', phone: '+923061234574', nationality: 'Pakistan' },
  { id: 'g-10', name: 'Zainab Hussain', phone: '+923221234575', nationality: 'Pakistan' },
  { id: 'g-11', name: 'Usman Tariq', phone: '+923011234576', nationality: 'Pakistan' },
  { id: 'g-12', name: 'Maria Lopez', phone: '+34600123456', nationality: 'Spain' },
  { id: 'g-13', name: 'Daniyal Sheikh', phone: '+923351234577', nationality: 'Pakistan' },
  { id: 'g-14', name: 'Hina Baig', phone: '+923461234578', nationality: 'Pakistan' },
]

const P = sampleProperty.id
const mk = (
  n: number,
  guestId: string,
  roomId: string,
  roomTypeId: string,
  status: BookingStatus,
  source: BookingSource,
  checkIn: DateStr,
  checkOut: DateStr,
  nightlyRatePkr: number,
  adults = 2,
  notes?: string,
): SampleBooking => ({
  id: `b-${n}`,
  bookingNo: `CR-${n}`,
  propertyId: P,
  guestId,
  roomId,
  roomTypeId,
  status,
  source,
  checkIn,
  checkOut,
  adults,
  nightlyRatePkr,
  notes,
})

export const sampleBookings: SampleBooking[] = [
  mk(1001, 'g-01', 'room-301', 'rt-deluxe-king', 'checked_in', 'walk_in', d(-2), d(1), 17000),
  mk(1002, 'g-02', 'room-102', 'rt-twin', 'checked_in', 'phone', d(-1), d(0), 15000),
  mk(1003, 'g-03', 'room-201', 'rt-queen', 'confirmed', 'phone', d(0), d(2), 15000, 2, 'Late arrival, after 10pm'),
  mk(1004, 'g-04', 'room-401', 'rt-deluxe-family', 'confirmed', 'ota', d(0), d(3), 18500, 3, 'Booking.com'),
  mk(1005, 'g-05', 'room-302', 'rt-deluxe-king', 'confirmed', 'whatsapp', d(1), d(3), 17000),
  mk(1006, 'g-06', 'room-103', 'rt-twin', 'checked_out', 'walk_in', d(-3), d(-1), 15000),
  mk(1007, 'g-07', 'room-304', 'rt-deluxe-king', 'confirmed', 'direct', d(2), d(5), 17000),
  mk(1008, 'g-08', 'room-202', 'rt-queen', 'confirmed', 'walk_in', d(0), d(1), 15000, 1),
  mk(1009, 'g-09', 'room-305', 'rt-deluxe-king', 'checked_in', 'ota', d(-1), d(2), 17000, 2, 'Agoda'),
  mk(1010, 'g-10', 'room-402', 'rt-deluxe-family', 'confirmed', 'phone', d(3), d(4), 18500, 3),
  mk(1011, 'g-11', 'room-104', 'rt-twin', 'no_show', 'ota', d(-1), d(0), 15000),
  mk(1012, 'g-12', 'room-303', 'rt-deluxe-king', 'cancelled', 'direct', d(1), d(2), 17000),
  mk(1013, 'g-13', 'room-306', 'rt-deluxe-king', 'checked_in', 'whatsapp', d(-1), d(4), 17000),
  mk(1014, 'g-14', 'room-101', 'rt-twin', 'confirmed', 'walk_in', d(1), d(2), 15000),
]

export const samplePayments: SamplePayment[] = [
  { id: 'p-01', bookingId: 'b-1001', amountPkr: 34000, method: 'cash', receivedOn: d(-2) },
  { id: 'p-02', bookingId: 'b-1002', amountPkr: 15000, method: 'jazzcash', receivedOn: d(0), reference: 'JC-88213' },
  { id: 'p-03', bookingId: 'b-1009', amountPkr: 17000, method: 'bank_transfer', receivedOn: d(-1), reference: 'HBL-5521' },
  { id: 'p-04', bookingId: 'b-1004', amountPkr: 18500, method: 'easypaisa', receivedOn: d(0), reference: 'EP-10927' },
  { id: 'p-05', bookingId: 'b-1013', amountPkr: 20000, method: 'cash', receivedOn: d(0) },
]

// --- lookups ---
const ACTIVE: ReadonlyArray<BookingStatus> = ['confirmed', 'checked_in']
export const isActiveBooking = (bk: SampleBooking) => ACTIVE.includes(bk.status)

export const guestById = (id: string) => sampleGuests.find((g) => g.id === id)
export const roomById = (id: string): SampleRoom | undefined => sampleRooms.find((r) => r.id === id)
export const roomTypeById = (id: string): SampleRoomType | undefined =>
  sampleRoomTypes.find((r) => r.id === id)
export const bookingById = (id: string) => sampleBookings.find((bk) => bk.id === id)

/** All non-cancelled bookings for a room (drawn on the calendar). */
export const bookingsForRoom = (roomId: string) =>
  sampleBookings.filter((bk) => bk.roomId === roomId && bk.status !== 'cancelled')

/** Statuses that occupy a room: completed stays still count for their past nights. */
const OCCUPYING: ReadonlyArray<BookingStatus> = ['confirmed', 'checked_in', 'checked_out']

/** Bookings occupying a room on a given night (excludes cancelled and no-show). */
export const occupiedOnNight = (night: DateStr) =>
  sampleBookings.filter(
    (bk) => OCCUPYING.includes(bk.status) && isNightCovered(bk.checkIn, bk.checkOut, night),
  )

export const paymentsForBooking = (bookingId: string) =>
  samplePayments.filter((p) => p.bookingId === bookingId)
