// Bookings: read models over v_bookings (server-side filters, search and
// paging) and the SECURITY INVOKER actions. Every hook is scoped by tenant +
// property; nothing loads the whole table.
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BookingSource, BookingStatus, Database, HousekeepingStatus, PaymentMethod } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { addDaysStr, type DateStr } from '@/lib/clock'
import { keys } from './keys'
import { useHotelToday, useTenant } from './tenant'
import type { BookingVM, IdType } from './types'

type VBooking = Database['public']['Views']['v_bookings']['Row']

export const BOOKING_FILTERS = ['all', 'arriving', 'inHouse', 'departing', 'upcoming', 'due', 'past', 'cancelled'] as const
export type BookingFilter = (typeof BOOKING_FILTERS)[number]

const PAGE = 30

export function toBookingVM(r: VBooking): BookingVM {
  return {
    id: r.id!,
    bookingNo: r.booking_no!,
    status: r.status as BookingStatus,
    source: r.source as BookingSource,
    checkIn: r.check_in!,
    checkOut: r.check_out!,
    nights: r.nights ?? 0,
    adults: r.adults ?? 1,
    children: r.children ?? 0,
    notes: r.notes,
    createdAt: r.created_at!,
    checkedInAt: r.checked_in_at,
    checkedOutAt: r.checked_out_at,
    cancelledAt: r.cancelled_at,
    cancellationReason: r.cancellation_reason,
    noShowAt: r.no_show_at,
    checkoutOverrideReason: r.checkout_override_reason,
    guest: {
      id: r.guest_id!,
      name: r.guest_name ?? '',
      phone: r.guest_phone,
      nationality: r.guest_nationality,
      hasId: r.guest_has_id ?? false,
    },
    room: r.room_id
      ? {
          id: r.room_id,
          label: r.room_label ?? '',
          hkStatus: (r.room_hk_status ?? 'clean') as HousekeepingStatus,
          typeId: r.room_type_id ?? '',
          typeName: r.room_type_name ?? '',
        }
      : null,
    nightlyRatePkr: Number(r.nightly_rate_pkr ?? 0),
    folio: r.folio_id
      ? {
          id: r.folio_id,
          no: r.folio_no,
          status: (r.folio_status ?? 'open') as 'open' | 'closed',
          charges: Number(r.total_charges ?? 0),
          tax: Number(r.total_tax ?? 0),
          payments: Number(r.total_payments ?? 0),
          balance: Number(r.balance ?? 0),
        }
      : null,
  }
}

function base(propertyId: string) {
  return supabase.from('v_bookings').select('*').eq('property_id', propertyId)
}

/** Stays touching [from, to] — the calendar window. No-shows included (hidden client-side), cancellations excluded. */
export function useBookingsInRange(from: DateStr, to: DateStr) {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.bookingsRange(scope, from, to),
    queryFn: async (): Promise<BookingVM[]> => {
      const { data, error } = await base(scope.propertyId)
        .lte('check_in', to)
        .gte('check_out', from)
        .neq('status', 'cancelled')
        .order('check_in')
      if (error) throw toAppError(error)
      return data.map(toBookingVM)
    },
  })
}

/** Everything Today needs in one query: arrivals and departures of the day, in-house, and recent late arrivals. */
export function useTodayBookings() {
  const { scope } = useTenant()
  const today = useHotelToday()
  return useQuery({
    queryKey: keys.bookingsToday(scope, today),
    refetchInterval: 60_000,
    queryFn: async (): Promise<BookingVM[]> => {
      const since = addDaysStr(today, -14)
      const { data, error } = await base(scope.propertyId)
        .neq('status', 'cancelled')
        .or(`check_in.eq.${today},check_out.eq.${today},status.eq.checked_in,and(status.eq.confirmed,check_in.lt.${today},check_in.gte.${since})`)
        .order('check_in')
      if (error) throw toAppError(error)
      return data.map(toBookingVM)
    },
  })
}

function sanitizeSearch(q: string) {
  return q.replace(/[,.()"'*%\\]/g, ' ').trim()
}

/** Paged list with server-side filter + search. */
export function useBookingsList(filter: BookingFilter, q: string) {
  const { scope } = useTenant()
  const today = useHotelToday()
  const term = sanitizeSearch(q)
  return useInfiniteQuery({
    queryKey: keys.bookingsList(scope, filter, term, today),
    // keep the current rows on screen while a new filter / search term loads
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    getNextPageParam: (last: { rows: BookingVM[]; next: number | null }) => last.next,
    queryFn: async ({ pageParam }) => {
      let query = base(scope.propertyId)
      switch (filter) {
        case 'arriving':
          query = query.eq('check_in', today).in('status', ['confirmed', 'checked_in']).order('room_label')
          break
        case 'inHouse':
          query = query.eq('status', 'checked_in').order('room_label')
          break
        case 'departing':
          query = query.eq('check_out', today).in('status', ['checked_in', 'checked_out']).order('room_label')
          break
        case 'upcoming':
          query = query.gt('check_in', today).eq('status', 'confirmed').order('check_in')
          break
        case 'due':
          query = query.gt('balance', 0).in('status', ['checked_in', 'checked_out']).order('check_out', { ascending: false })
          break
        case 'past':
          query = query.eq('status', 'checked_out').order('check_out', { ascending: false })
          break
        case 'cancelled':
          query = query.in('status', ['cancelled', 'no_show']).order('check_in', { ascending: false })
          break
        default:
          query = query.order('check_in', { ascending: false })
      }
      if (term) {
        query = query.or(
          `booking_no.ilike.*${term}*,guest_name.ilike.*${term}*,guest_phone.ilike.*${term.replace(/\s/g, '')}*,room_label.ilike.*${term}*`,
        )
      }
      const from = pageParam * PAGE
      const { data, error } = await query.range(from, from + PAGE - 1)
      if (error) throw toAppError(error)
      return { rows: data.map(toBookingVM), next: data.length === PAGE ? pageParam + 1 : null }
    },
  })
}

export function useBooking(id: string | undefined) {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.booking(scope, id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<BookingVM | null> => {
      const { data, error } = await base(scope.propertyId).eq('id', id!).maybeSingle()
      if (error) throw toAppError(error)
      return data ? toBookingVM(data) : null
    },
  })
}

export function useGuestBookings(guestId: string | undefined) {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.bookingsOfGuest(scope, guestId ?? ''),
    enabled: Boolean(guestId),
    queryFn: async (): Promise<BookingVM[]> => {
      const { data, error } = await base(scope.propertyId).eq('guest_id', guestId!).order('check_in', { ascending: false }).limit(50)
      if (error) throw toAppError(error)
      return data.map(toBookingVM)
    },
  })
}

// ---------------------------------------------------------------- actions ----
export interface NewBookingInput {
  roomId: string
  checkIn: DateStr
  checkOut: DateStr
  adults: number
  children: number
  source: BookingSource
  nightlyRate: number
  guestId: string | null
  guestName: string | null
  guestPhone: string | null
  guestIdType: IdType | null
  guestIdNumber: string | null
  guestNationality: string | null
  notes: string | null
  deposit: number
  depositMethod: PaymentMethod | null
  checkInNow: boolean
}

function useInvalidateBookings() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return async (bookingId?: string, guestId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.bookings(scope) }),
      queryClient.invalidateQueries({ queryKey: keys.roomsBoard(scope) }),
      queryClient.invalidateQueries({ queryKey: keys.rooms(scope) }),
      queryClient.invalidateQueries({ queryKey: keys.guests(scope) }),
      bookingId ? queryClient.invalidateQueries({ queryKey: keys.folio(scope, bookingId) }) : Promise.resolve(),
      bookingId ? queryClient.invalidateQueries({ queryKey: keys.activity(scope, bookingId) }) : Promise.resolve(),
      guestId ? queryClient.invalidateQueries({ queryKey: keys.bookingsOfGuest(scope, guestId) }) : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: keys.cash(scope) }),
    ])
  }
}

export function useCreateBooking() {
  const { scope } = useTenant()
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: async (input: NewBookingInput): Promise<string> => {
      const { data, error } = await supabase.rpc('create_booking', {
        p_property_id: scope.propertyId,
        p_room_id: input.roomId,
        p_check_in: input.checkIn,
        p_check_out: input.checkOut,
        p_adults: input.adults,
        p_source: input.source,
        p_nightly_rate: input.nightlyRate,
        p_guest_id: input.guestId ?? undefined,
        p_guest_name: input.guestName ?? undefined,
        p_guest_phone: input.guestPhone ?? undefined,
        p_notes: input.notes ?? undefined,
        p_deposit: input.deposit,
        p_deposit_method: input.depositMethod ?? undefined,
        p_children: input.children,
        p_check_in_now: input.checkInNow,
        p_guest_id_type: input.guestIdType ?? undefined,
        p_guest_id_number: input.guestIdNumber ?? undefined,
        p_guest_nationality: input.guestNationality ?? undefined,
      })
      if (error) throw toAppError(error)
      return data
    },
    onSuccess: (id) => invalidate(id),
  })
}

export interface UpdateBookingInput {
  bookingId: string
  roomId: string
  checkIn: DateStr
  checkOut: DateStr
  adults: number
  children: number
  source: BookingSource
  nightlyRate: number
  notes: string | null
}

export function useUpdateBooking() {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: async (input: UpdateBookingInput) => {
      const { error } = await supabase.rpc('update_booking', {
        p_booking_id: input.bookingId,
        p_room_id: input.roomId,
        p_check_in: input.checkIn,
        p_check_out: input.checkOut,
        p_adults: input.adults,
        p_source: input.source,
        p_nightly_rate: input.nightlyRate,
        p_notes: input.notes ?? undefined,
        p_children: input.children,
      })
      if (error) throw toAppError(error)
    },
    onSuccess: (_d, v) => invalidate(v.bookingId),
  })
}

export function useSetBookingStatus() {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: async ({ bookingId, status, reason }: { bookingId: string; status: BookingStatus; reason?: string | null }) => {
      const { error } = await supabase.rpc('set_booking_status', {
        p_booking_id: bookingId,
        p_status: status,
        p_reason: reason ?? undefined,
      })
      if (error) throw toAppError(error)
    },
    onSuccess: (_d, v) => invalidate(v.bookingId),
  })
}
