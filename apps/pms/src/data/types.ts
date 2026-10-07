// View models the screens render. The hooks in ./bookings, ./folio, ./guests,
// ./rooms map database rows (typed from the generated schema) to these; screens
// never touch raw rows.
import type {
  BookingSource,
  BookingStatus,
  HousekeepingStatus,
  PaymentMethod,
  SubscriptionStatus,
  TenantRole,
} from '@hotel-digital/shared'
import type { DateStr } from '@/lib/clock'

export interface TenantVM {
  id: string
  slug: string
  name: string
}

export type TaxMode = 'none' | 'exclusive' | 'inclusive'
export type TaxApplies = 'room' | 'all'
export type EarlyDeparturePolicy = 'release' | 'charge_full'

export interface PropertyVM {
  id: string
  name: string
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  timezone: string
  currency: string
  checkInTime: string
  checkOutTime: string
  taxName: string | null
  taxRatePct: number
  taxMode: TaxMode
  taxAppliesTo: TaxApplies
  ntn: string | null
  strn: string | null
  requireIdAtCheckIn: boolean
  earlyDeparturePolicy: EarlyDeparturePolicy
}

export interface BrandingVM {
  legalName: string | null
  logoUrl: string | null
  primaryColor: string | null
}

export interface ChargePreset {
  label: string
  amount: number
  category: FolioCategory
}

export interface TenantSettingsVM {
  bookingPrefix: string
  receiptPrefix: string
  folioPrefix: string
  chargePresets: ChargePreset[]
  receiptFooter: string | null
}

export interface AccessVM {
  status: SubscriptionStatus
  accessLevel: 'full' | 'read_only' | 'none'
}

export interface MembershipVM {
  id: string
  userId: string
  role: TenantRole
  email: string | null
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

export interface RoomBoardVM extends RoomVM {
  roomTypeName: string
  current: {
    bookingId: string
    bookingNo: string
    guestName: string
    checkIn: DateStr
    checkOut: DateStr
    balance: number
  } | null
  next: {
    bookingId: string
    guestName: string
    checkIn: DateStr
    checkOut: DateStr
  } | null
}

export type IdType = 'cnic' | 'nicop' | 'poc' | 'passport' | 'other'

export interface GuestVM {
  id: string
  name: string
  phone: string | null
  email: string | null
  nationality: string | null
  idType: IdType | null
  idNumber: string | null
  idExpiry: DateStr | null
  address: string | null
  notes: string | null
  hasId: boolean
  stays: number
  lastCheckIn: DateStr | null
  due: number
  inHouse: boolean
}

export interface BookingVM {
  id: string
  bookingNo: string
  status: BookingStatus
  source: BookingSource
  checkIn: DateStr
  checkOut: DateStr
  nights: number
  adults: number
  children: number
  notes: string | null
  createdAt: string
  checkedInAt: string | null
  checkedOutAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  noShowAt: string | null
  checkoutOverrideReason: string | null
  guest: {
    id: string
    name: string
    phone: string | null
    nationality: string | null
    hasId: boolean
  }
  room: {
    id: string
    label: string
    hkStatus: HousekeepingStatus
    typeId: string
    typeName: string
  } | null
  nightlyRatePkr: number
  folio: {
    id: string
    no: string | null
    status: 'open' | 'closed'
    charges: number
    tax: number
    payments: number
    balance: number
  } | null
}

export type FolioItemKind = 'charge' | 'payment' | 'discount' | 'refund'
export type FolioCategory =
  | 'room'
  | 'food'
  | 'laundry'
  | 'minibar'
  | 'extra'
  | 'fee'
  | 'adjustment'
  | 'deposit'
  | 'settlement'
  | 'other'

export interface FolioItemVM {
  id: string
  kind: FolioItemKind
  category: FolioCategory
  source: 'manual' | 'auto' | 'system'
  description: string
  amountPkr: number
  taxPkr: number
  method: PaymentMethod | null
  reference: string | null
  receiptNo: string | null
  serviceDate: DateStr | null
  businessDate: DateStr
  postedAt: string
  postedBy: string | null
  voidedAt: string | null
  voidReason: string | null
}

export interface FolioVM {
  id: string
  no: string | null
  status: 'open' | 'closed'
  totalCharges: number
  totalTax: number
  totalPayments: number
  balance: number
  items: FolioItemVM[]
}

export interface CashShiftVM {
  id: string
  shiftDate: DateStr
  status: 'open' | 'handed_over' | 'confirmed'
  openingFloat: number
  openedBy: string | null
  openedAt: string
  declared: Partial<Record<PaymentMethod, number>>
  expected: Partial<Record<PaymentMethod, number>> | null
  confirmed: Partial<Record<PaymentMethod, number>> | null
  discrepancy: Partial<Record<PaymentMethod, number>> | null
  closedBy: string | null
  closedAt: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  notes: string | null
}

/** Statuses that block a room on the nights of their stay (mirrors the EXCLUDE predicate). */
export const OCCUPYING_STATUSES: ReadonlySet<BookingStatus> = new Set(['confirmed', 'checked_in', 'checked_out'])

export const isLive = (b: Pick<BookingVM, 'status'>) => b.status === 'confirmed' || b.status === 'checked_in'
export const owesMoney = (b: Pick<BookingVM, 'folio' | 'status'>) =>
  (b.folio?.balance ?? 0) > 0 && b.status !== 'cancelled' && b.status !== 'no_show'
export const hasCredit = (b: Pick<BookingVM, 'folio'>) => (b.folio?.balance ?? 0) < 0
