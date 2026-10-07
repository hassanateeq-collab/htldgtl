// Settings: property, tenant settings (data, never code — ADR 0003), branding,
// room types and rooms, staff. Owner / manager only (RLS enforces it).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json, TenantRole } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { keys } from './keys'
import { useTenant } from './tenant'
import type { ChargePreset, MembershipVM, PropertyVM } from './types'

export interface StaffMember extends MembershipVM {
  createdAt: string
}

export function useMembers() {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.members(scope),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase.rpc('tenant_members')
      if (error) throw toAppError(error)
      return data.map((m) => ({ id: m.membership_id, userId: m.user_id, role: m.role, email: m.email, createdAt: m.created_at }))
    },
  })
}

/** user id → display label (email) for "posted by" and activity rows. */
export function useStaffNames(): (userId: string | null | undefined) => string | null {
  const members = useMembers()
  return (userId) => {
    if (!userId) return null
    return members.data?.find((m) => m.userId === userId)?.email ?? null
  }
}

function useRefreshTenant() {
  const queryClient = useQueryClient()
  const { refresh, scope } = useTenant()
  return async () => {
    refresh()
    await queryClient.invalidateQueries({ queryKey: keys.all(scope) })
  }
}

export type PropertyInput = Pick<
  PropertyVM,
  | 'name'
  | 'address'
  | 'city'
  | 'phone'
  | 'email'
  | 'checkInTime'
  | 'checkOutTime'
  | 'taxMode'
  | 'taxName'
  | 'taxRatePct'
  | 'taxAppliesTo'
  | 'ntn'
  | 'strn'
  | 'requireIdAtCheckIn'
  | 'earlyDeparturePolicy'
>

export function useUpdateProperty() {
  const { scope } = useTenant()
  const refresh = useRefreshTenant()
  return useMutation({
    mutationFn: async (input: PropertyInput) => {
      const { error } = await supabase
        .from('properties')
        .update({
          name: input.name,
          address: input.address,
          city: input.city,
          phone: input.phone,
          email: input.email,
          check_in_time: input.checkInTime,
          check_out_time: input.checkOutTime,
          tax_mode: input.taxMode,
          tax_name: input.taxMode === 'none' ? null : input.taxName,
          tax_rate_pct: input.taxMode === 'none' ? 0 : input.taxRatePct,
          tax_applies_to: input.taxAppliesTo,
          ntn: input.ntn,
          strn: input.strn,
          require_id_at_check_in: input.requireIdAtCheckIn,
          early_departure_policy: input.earlyDeparturePolicy,
        })
        .eq('id', scope.propertyId)
      if (error) throw toAppError(error)
    },
    onSuccess: () => refresh(),
  })
}

export interface TenantSettingsInput {
  bookingPrefix: string
  receiptPrefix: string
  folioPrefix: string
  chargePresets: ChargePreset[]
  receiptFooter: string | null
}

export function useUpdateSettings() {
  const { scope } = useTenant()
  const refresh = useRefreshTenant()
  return useMutation({
    mutationFn: async (input: TenantSettingsInput) => {
      // Plain data only (ADR 0003); the cast is needed because interfaces have no index signature for Json.
      const settings = {
        booking_prefix: input.bookingPrefix,
        receipt_prefix: input.receiptPrefix,
        folio_prefix: input.folioPrefix,
        charge_presets: input.chargePresets.map((p) => ({ label: p.label, amount: p.amount, category: p.category })),
        receipt_footer: input.receiptFooter,
      } as unknown as Json
      const { error } = await supabase.from('tenant_settings').update({ settings }).eq('tenant_id', scope.tenantId)
      if (error) throw toAppError(error)
    },
    onSuccess: () => refresh(),
  })
}

export function useUpdateBranding() {
  const { scope } = useTenant()
  const refresh = useRefreshTenant()
  return useMutation({
    mutationFn: async (input: { legalName: string | null; logoUrl: string | null }) => {
      const { error } = await supabase
        .from('tenant_branding')
        .update({ legal_name: input.legalName, logo_url: input.logoUrl })
        .eq('tenant_id', scope.tenantId)
      if (error) throw toAppError(error)
    },
    onSuccess: () => refresh(),
  })
}

export interface RoomTypeInput {
  id?: string
  name: string
  baseRatePkr: number
  bedConfig: string | null
  sizeSqm: number | null
  baseOccupancy: number
  maxOccupancy: number
  sortOrder: number
}

export function useSaveRoomType() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return useMutation({
    mutationFn: async (input: RoomTypeInput) => {
      const row = {
        name: input.name,
        base_rate_pkr: input.baseRatePkr,
        bed_config: input.bedConfig,
        size_sqm: input.sizeSqm,
        base_occupancy: input.baseOccupancy,
        max_occupancy: input.maxOccupancy,
        sort_order: input.sortOrder,
      }
      const { error } = input.id
        ? await supabase.from('room_types').update(row).eq('id', input.id)
        : await supabase.from('room_types').insert({ ...row, tenant_id: scope.tenantId, property_id: scope.propertyId })
      if (error) throw toAppError(error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all(scope) }),
  })
}

export interface RoomInput {
  id?: string
  label: string
  floor: number | null
  roomTypeId: string
  isActive: boolean
}

export function useSaveRoom() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return useMutation({
    mutationFn: async (input: RoomInput) => {
      const row = { label: input.label, floor: input.floor, room_type_id: input.roomTypeId, is_active: input.isActive }
      const { error } = input.id
        ? await supabase.from('rooms').update(row).eq('id', input.id)
        : await supabase.from('rooms').insert({ ...row, tenant_id: scope.tenantId, property_id: scope.propertyId })
      if (error) throw toAppError(error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all(scope) }),
  })
}

export function useSetMemberRole() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return useMutation({
    mutationFn: async ({ membershipId, role }: { membershipId: string; role: TenantRole }) => {
      const { error } = await supabase.from('memberships').update({ role }).eq('id', membershipId)
      if (error) throw toAppError(error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.members(scope) }),
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string }) => {
      const { error } = await supabase.from('memberships').delete().eq('id', membershipId)
      if (error) throw toAppError(error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.members(scope) }),
  })
}
