// View models the screens render. Hooks in ./queries.ts map database rows to
// these; screens never touch raw rows.
import type {
  BookingSource,
  BookingStatus,
  HousekeepingStatus,
  PaymentMethod,
  SubscriptionStatus,
} from '@hotel-digital/shared'
import type { DateStr } from '@/lib/dates'

export interface TenantVM {
  id: string
  slug: string
  name: string
}

export interface PropertyVM {
  id: string
  name: string
  city: string | null
  address: string | null
  timezone: string
  currency: string
}

export interface AccessVM {
  status: SubscriptionStatus
  accessLevel: 'full' | 'read_only' | 'none'
}

export interface RoomTypeVM {
  id: string
  name: string
  bedConfig: string | null
  sizeSqm: number | null
  baseOccupancy: number
  maxOccupancy: number
  baseRatePkr: number
  sortOrder: number
}

export interface RoomVM {
  id: string
  roomTypeId: string
  label: string
  floor: number | null
  housekeepingStatus: HousekeepingStatus
  isActive: boolean
}

export interface GuestVM {
  id: string
  name: string
  phone: string | null
  email: string | null
  nationality: string | null
}

export interface BookingVM {
  id: string
  bookingNo: string
  status: BookingStatus
  source: BookingSource
  checkIn: DateStr
  checkOut: DateStr
  adults: number
  notes: string | null
  guest: GuestVM | null
  /** First assigned room (v1: one room per booking). */
  roomId: string | null
  roomLabel: string | null
  roomTypeId: string | null
  roomTypeName: string | null
  nightlyRatePkr: number
}

export interface FolioItemVM {
  id: string
  kind: 'charge' | 'payment'
  description: string
  amountPkr: number
  method: PaymentMethod | null
  reference: string | null
  postedAt: string
}

export interface FolioVM {
  id: string
  status: 'open' | 'closed'
  totalCharges: number
  totalPayments: number
  balance: number
  items: FolioItemVM[]
}

export interface PaymentVM {
  id: string
  amountPkr: number
  method: PaymentMethod
}

/** Bookings that still hold a room. */
export const ACTIVE_STATUSES: ReadonlySet<BookingStatus> = new Set(['confirmed', 'checked_in'])
/** Statuses that occupy a room on their nights (completed stays count for past nights). */
export const OCCUPYING_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'confirmed',
  'checked_in',
  'checked_out',
])
