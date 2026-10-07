// Guests: server-side search over v_guests (stats included), one guest, the
// phone-first lookup used by the booking form, and profile edits.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@hotel-digital/shared'
import { normalizePhone } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { keys } from './keys'
import { useTenant } from './tenant'
import type { GuestVM, IdType } from './types'

type VGuestRow = Database['public']['Views']['v_guests']['Row']
type VGuest = Pick<
  VGuestRow,
  'id' | 'name' | 'phone' | 'email' | 'nationality' | 'id_type' | 'id_number' | 'id_expiry' | 'address' | 'notes' | 'has_id' | 'stays' | 'last_check_in' | 'due' | 'in_house'
>

const SELECT = 'id, name, phone, email, nationality, id_type, id_number, id_expiry, address, notes, has_id, stays, last_check_in, due, in_house'

export function toGuestVM(r: VGuest): GuestVM {
  return {
    id: r.id!,
    name: r.name ?? '',
    phone: r.phone,
    email: r.email,
    nationality: r.nationality,
    idType: r.id_type as IdType | null,
    idNumber: r.id_number,
    idExpiry: r.id_expiry,
    address: r.address,
    notes: r.notes,
    hasId: r.has_id ?? false,
    stays: r.stays ?? 0,
    lastCheckIn: r.last_check_in,
    due: Number(r.due ?? 0),
    inHouse: r.in_house ?? false,
  }
}

function sanitize(q: string) {
  return q.replace(/[,.()"'*%\\]/g, ' ').trim()
}

/** Guest directory: name or phone search, 50 at a time, ordered by name. */
export function useGuestsList(q: string) {
  const { scope } = useTenant()
  const term = sanitize(q)
  return useQuery({
    queryKey: keys.guestsList(scope, term),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GuestVM[]> => {
      let query = supabase.from('v_guests').select(SELECT).eq('tenant_id', scope.tenantId)
      if (term) {
        const digits = term.replace(/\D/g, '').replace(/^0/, '')
        const parts = [`name.ilike.*${term}*`]
        if (digits.length >= 3) parts.push(`phone.ilike.*${digits}*`)
        query = query.or(parts.join(','))
      }
      const { data, error } = await query.order('name').limit(50)
      if (error) throw toAppError(error)
      return data.map(toGuestVM)
    },
  })
}

export function useGuest(id: string | undefined) {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.guest(scope, id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<GuestVM | null> => {
      const { data, error } = await supabase.from('v_guests').select(SELECT).eq('id', id!).maybeSingle()
      if (error) throw toAppError(error)
      return data ? toGuestVM(data) : null
    },
  })
}

/** Phone-first lookup for the booking form: exact phone, then name prefix. */
export function useGuestLookup(raw: string) {
  const { scope } = useTenant()
  const term = sanitize(raw)
  const phone = normalizePhone(term)
  const isPhone = /^\+?\d[\d\s-]{5,}$/.test(term)
  return useQuery({
    queryKey: keys.guestLookup(scope, term),
    enabled: term.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<GuestVM[]> => {
      let query = supabase.from('v_guests').select(SELECT).eq('tenant_id', scope.tenantId)
      query = isPhone && phone ? query.ilike('phone', `*${phone.replace(/^\+92/, '').replace(/^\+/, '')}*`) : query.ilike('name', `*${term}*`)
      const { data, error } = await query.order('name').limit(6)
      if (error) throw toAppError(error)
      return data.map(toGuestVM)
    },
  })
}

/** Record a guest's ID document from the check-in sheet without opening the full profile. */
export function useSetGuestId() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return useMutation({
    mutationFn: async ({ guestId, idType, idNumber }: { guestId: string; idType: IdType; idNumber: string }) => {
      const { error } = await supabase.from('guests').update({ id_type: idType, id_number: idNumber }).eq('id', guestId)
      if (error) throw toAppError(error)
    },
    onSuccess: async (_d, v) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.guests(scope) }),
        queryClient.invalidateQueries({ queryKey: keys.guest(scope, v.guestId) }),
        queryClient.invalidateQueries({ queryKey: keys.bookings(scope) }),
      ])
    },
  })
}

export interface UpdateGuestInput {
  id: string
  name: string
  phone: string | null
  email: string | null
  nationality: string | null
  idType: IdType | null
  idNumber: string | null
  idExpiry: string | null
  address: string | null
  notes: string | null
}

export function useUpdateGuest() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return useMutation({
    mutationFn: async (input: UpdateGuestInput) => {
      const { error } = await supabase
        .from('guests')
        .update({
          name: input.name,
          phone: input.phone,
          email: input.email,
          nationality: input.nationality,
          id_type: input.idType,
          id_number: input.idNumber,
          id_expiry: input.idExpiry,
          address: input.address,
          notes: input.notes,
        })
        .eq('id', input.id)
      if (error) throw toAppError(error)
    },
    onSuccess: async (_d, v) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.guests(scope) }),
        queryClient.invalidateQueries({ queryKey: keys.bookings(scope) }),
        queryClient.invalidateQueries({ queryKey: keys.guest(scope, v.id) }),
      ])
    },
  })
}
