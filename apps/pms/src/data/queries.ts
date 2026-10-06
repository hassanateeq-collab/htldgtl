// React Query hooks over Supabase. Every query runs behind RLS with the user's
// JWT; the active tenant comes from the claim, so hooks only scope by property.
import { useQuery } from '@tanstack/react-query'
import { addDays, startOfDay } from 'date-fns'
import type { BookingSource, BookingStatus, HousekeepingStatus, PaymentMethod } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import type { BookingVM, FolioVM, PaymentVM, RoomTypeVM, RoomVM } from './types'

export const keys = {
  roomTypes: (propertyId: string) => ['room-types', propertyId] as const,
  rooms: (propertyId: string) => ['rooms', propertyId] as const,
  bookings: (propertyId: string) => ['bookings', propertyId] as const,
  folio: (bookingId: string) => ['folio', bookingId] as const,
  todayPayments: (propertyId: string, day: string) => ['payments-today', propertyId, day] as const,
}

// --- row shapes (subset of columns we select) ---
interface RoomTypeRow {
  id: string
  name: string
  bed_config: string | null
  size_sqm: number | null
  base_occupancy: number
  max_occupancy: number
  base_rate_pkr: number | string
  sort_order: number
}

interface RoomRow {
  id: string
  room_type_id: string
  label: string
  floor: number | null
  housekeeping_status: HousekeepingStatus
  is_active: boolean
}

interface GuestRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  nationality: string | null
}

interface BookingRoomRow {
  id: string
  room_id: string
  room_type_id: string
  nightly_rate_pkr: number | string
  room: { id: string; label: string; room_type: { id: string; name: string } | null } | null
}

interface BookingRow {
  id: string
  booking_no: string
  status: BookingStatus
  source: BookingSource
  check_in: string
  check_out: string
  adults: number
  notes: string | null
  guest: GuestRow | null
  rooms: BookingRoomRow[]
}

interface FolioItemRow {
  id: string
  kind: 'charge' | 'payment'
  description: string
  amount_pkr: number | string
  method: PaymentMethod | null
  reference: string | null
  posted_at: string
}

interface FolioRow {
  id: string
  status: 'open' | 'closed'
  total_charges: number | string
  total_payments: number | string
  balance: number | string
  items: FolioItemRow[]
}

interface PaymentRow {
  id: string
  amount_pkr: number | string
  method: PaymentMethod
}

const BOOKING_SELECT = `
  id, booking_no, status, source, check_in, check_out, adults, notes,
  guest:guests(id, name, phone, email, nationality),
  rooms:booking_rooms(id, room_id, room_type_id, nightly_rate_pkr,
    room:rooms(id, label, room_type:room_types(id, name)))
`

function toBookingVM(row: BookingRow): BookingVM {
  const first = row.rooms[0]
  return {
    id: row.id,
    bookingNo: row.booking_no,
    status: row.status,
    source: row.source,
    checkIn: row.check_in,
    checkOut: row.check_out,
    adults: row.adults,
    notes: row.notes,
    guest: row.guest,
    roomId: first?.room_id ?? null,
    roomLabel: first?.room?.label ?? null,
    roomTypeId: first?.room_type_id ?? null,
    roomTypeName: first?.room?.room_type?.name ?? null,
    nightlyRatePkr: first ? Number(first.nightly_rate_pkr) : 0,
  }
}

export function useRoomTypes(propertyId: string) {
  return useQuery({
    queryKey: keys.roomTypes(propertyId),
    queryFn: async (): Promise<RoomTypeVM[]> => {
      const { data, error } = await supabase
        .from('room_types')
        .select('id, name, bed_config, size_sqm, base_occupancy, max_occupancy, base_rate_pkr, sort_order')
        .eq('property_id', propertyId)
        .order('sort_order')
      if (error) throw error
      return ((data ?? []) as RoomTypeRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        bedConfig: r.bed_config,
        sizeSqm: r.size_sqm,
        baseOccupancy: r.base_occupancy,
        maxOccupancy: r.max_occupancy,
        baseRatePkr: Number(r.base_rate_pkr),
        sortOrder: r.sort_order,
      }))
    },
  })
}

export function useRooms(propertyId: string) {
  return useQuery({
    queryKey: keys.rooms(propertyId),
    queryFn: async (): Promise<RoomVM[]> => {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_type_id, label, floor, housekeeping_status, is_active')
        .eq('property_id', propertyId)
        .order('label')
      if (error) throw error
      return ((data ?? []) as RoomRow[]).map((r) => ({
        id: r.id,
        roomTypeId: r.room_type_id,
        label: r.label,
        floor: r.floor,
        housekeepingStatus: r.housekeeping_status,
        isActive: r.is_active,
      }))
    },
  })
}

export function useBookings(propertyId: string) {
  return useQuery({
    queryKey: keys.bookings(propertyId),
    queryFn: async (): Promise<BookingVM[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select(BOOKING_SELECT)
        .eq('property_id', propertyId)
        .order('check_in')
      if (error) throw error
      return ((data ?? []) as unknown as BookingRow[]).map(toBookingVM)
    },
  })
}

export function useFolio(bookingId: string | undefined) {
  return useQuery({
    queryKey: keys.folio(bookingId ?? ''),
    enabled: Boolean(bookingId),
    queryFn: async (): Promise<FolioVM | null> => {
      const { data, error } = await supabase
        .from('folios')
        .select(
          'id, status, total_charges, total_payments, balance, items:folio_items(id, kind, description, amount_pkr, method, reference, posted_at)',
        )
        .eq('booking_id', bookingId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const row = data as unknown as FolioRow
      return {
        id: row.id,
        status: row.status,
        totalCharges: Number(row.total_charges),
        totalPayments: Number(row.total_payments),
        balance: Number(row.balance),
        items: [...row.items]
          .sort((a, b) => a.posted_at.localeCompare(b.posted_at))
          .map((i) => ({
            id: i.id,
            kind: i.kind,
            description: i.description,
            amountPkr: Number(i.amount_pkr),
            method: i.method,
            reference: i.reference,
            postedAt: i.posted_at,
          })),
      }
    },
  })
}

/** Payments posted today (device-local day), for the Today cash tile. */
export function useTodayPayments(propertyId: string) {
  const start = startOfDay(new Date())
  const end = addDays(start, 1)
  const dayKey = start.toISOString().slice(0, 10)
  return useQuery({
    queryKey: keys.todayPayments(propertyId, dayKey),
    queryFn: async (): Promise<PaymentVM[]> => {
      const { data, error } = await supabase
        .from('folio_items')
        .select('id, amount_pkr, method')
        .eq('property_id', propertyId)
        .eq('kind', 'payment')
        .gte('posted_at', start.toISOString())
        .lt('posted_at', end.toISOString())
      if (error) throw error
      return ((data ?? []) as PaymentRow[]).map((p) => ({
        id: p.id,
        amountPkr: Number(p.amount_pkr),
        method: p.method,
      }))
    },
  })
}
