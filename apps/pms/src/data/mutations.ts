// Write actions. Status changes and booking creation go through SECURITY
// INVOKER database functions (RLS applies as the caller); folio items are
// plain inserts (tenant/property are filled from the folio by trigger).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { t, type BookingSource, type BookingStatus, type MessageKey, type PaymentMethod } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { keys } from './queries'

export type ActionErrorKind = 'room_taken' | 'balance_due' | 'forbidden' | 'bad_transition' | 'unknown'

export class ActionError extends Error {
  constructor(
    readonly kind: ActionErrorKind,
    readonly original: string,
  ) {
    super(kind)
  }
}

/** Map Postgres / PostgREST errors to a small set of user-facing kinds. */
export function translateError(e: unknown): ActionError {
  const err = (e ?? {}) as { code?: string; message?: string }
  const code = err.code ?? ''
  const message = err.message ?? ''
  if (code === '23P01' || /booking_rooms_no_overlap/i.test(message)) return new ActionError('room_taken', message)
  if (/balance due/i.test(message)) return new ActionError('balance_due', message)
  if (code === '42501' || /row-level security|not permitted|permission denied/i.test(message)) {
    return new ActionError('forbidden', message)
  }
  if (/cannot go from|not found/i.test(message)) return new ActionError('bad_transition', message)
  return new ActionError('unknown', message)
}

export function actionErrorLabel(e: unknown): string {
  const kind: ActionErrorKind = e instanceof ActionError ? e.kind : 'unknown'
  return t(`error.${kind}` as MessageKey)
}

export function useSetBookingStatus(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: BookingStatus }) => {
      const { error } = await supabase.rpc('set_booking_status', { p_booking_id: bookingId, p_status: status })
      if (error) throw translateError(error)
    },
    onSuccess: (_data, { bookingId }) => {
      void queryClient.invalidateQueries({ queryKey: keys.bookings(propertyId) })
      void queryClient.invalidateQueries({ queryKey: keys.folio(bookingId) })
      void queryClient.invalidateQueries({ queryKey: keys.rooms(propertyId) })
    },
  })
}

export interface NewFolioItem {
  folioId: string
  bookingId: string
  kind: 'charge' | 'payment'
  description: string
  amountPkr: number
  method: PaymentMethod | null
  reference: string | null
}

export function useAddFolioItem(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: NewFolioItem) => {
      const { error } = await supabase.from('folio_items').insert({
        folio_id: item.folioId,
        kind: item.kind,
        description: item.description,
        amount_pkr: item.amountPkr,
        method: item.method,
        reference: item.reference,
      })
      if (error) throw translateError(error)
    },
    onSuccess: (_data, { bookingId }) => {
      void queryClient.invalidateQueries({ queryKey: keys.folio(bookingId) })
      void queryClient.invalidateQueries({ queryKey: ['payments-today', propertyId] })
    },
  })
}

export interface NewBookingInput {
  propertyId: string
  roomId: string
  checkIn: string
  checkOut: string
  adults: number
  source: BookingSource
  nightlyRate: number
  guestId: string | null
  guestName: string | null
  guestPhone: string | null
  notes: string | null
}

export function useCreateBooking(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewBookingInput): Promise<string> => {
      const { data, error } = await supabase.rpc('create_booking', {
        p_property_id: input.propertyId,
        p_room_id: input.roomId,
        p_check_in: input.checkIn,
        p_check_out: input.checkOut,
        p_adults: input.adults,
        p_source: input.source,
        p_nightly_rate: input.nightlyRate,
        p_guest_id: input.guestId,
        p_guest_name: input.guestName,
        p_guest_phone: input.guestPhone,
        p_notes: input.notes,
      })
      if (error) throw translateError(error)
      return data as string
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bookings(propertyId) })
    },
  })
}
