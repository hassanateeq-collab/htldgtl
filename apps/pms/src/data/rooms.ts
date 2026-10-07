// Rooms and room types; the rooms board (one row per room with its current and
// next stay); housekeeping status changes and their history.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database, HousekeepingStatus } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { keys } from './keys'
import { useTenant } from './tenant'
import type { RoomBoardVM, RoomTypeVM, RoomVM } from './types'

type VRoomBoard = Database['public']['Views']['v_rooms_board']['Row']

export function useRoomTypes() {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.roomTypes(scope),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RoomTypeVM[]> => {
      const { data, error } = await supabase
        .from('room_types')
        .select('id, name, bed_config, size_sqm, base_occupancy, max_occupancy, base_rate_pkr, sort_order')
        .eq('property_id', scope.propertyId)
        .order('sort_order')
        .order('name')
      if (error) throw toAppError(error)
      return data.map((r) => ({
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

export function useRooms() {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.rooms(scope),
    staleTime: 60_000,
    queryFn: async (): Promise<RoomVM[]> => {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_type_id, label, floor, housekeeping_status, is_active')
        .eq('property_id', scope.propertyId)
        .order('label')
      if (error) throw toAppError(error)
      return data.map((r) => ({
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

function toBoardVM(r: VRoomBoard): RoomBoardVM {
  return {
    id: r.id!,
    roomTypeId: r.room_type_id!,
    roomTypeName: r.room_type_name ?? '',
    label: r.label ?? '',
    floor: r.floor,
    housekeepingStatus: (r.housekeeping_status ?? 'clean') as HousekeepingStatus,
    isActive: r.is_active ?? true,
    current: r.current_booking_id
      ? {
          bookingId: r.current_booking_id,
          bookingNo: r.current_booking_no ?? '',
          guestName: r.current_guest_name ?? '',
          checkIn: r.current_check_in ?? '',
          checkOut: r.current_check_out ?? '',
          balance: Number(r.current_balance ?? 0),
        }
      : null,
    next: r.next_booking_id
      ? {
          bookingId: r.next_booking_id,
          guestName: r.next_guest_name ?? '',
          checkIn: r.next_check_in ?? '',
          checkOut: r.next_check_out ?? '',
        }
      : null,
  }
}

export function useRoomsBoard() {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.roomsBoard(scope),
    refetchInterval: 60_000,
    queryFn: async (): Promise<RoomBoardVM[]> => {
      const { data, error } = await supabase.from('v_rooms_board').select('*').eq('property_id', scope.propertyId).order('label')
      if (error) throw toAppError(error)
      return data.map(toBoardVM)
    },
  })
}

export function useSetRoomStatus() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return useMutation({
    mutationFn: async ({ roomId, status }: { roomId: string; status: HousekeepingStatus }) => {
      const { error } = await supabase.from('rooms').update({ housekeeping_status: status }).eq('id', roomId)
      if (error) throw toAppError(error)
    },
    onMutate: async ({ roomId, status }) => {
      await queryClient.cancelQueries({ queryKey: keys.roomsBoard(scope) })
      const previous = queryClient.getQueryData<RoomBoardVM[]>(keys.roomsBoard(scope))
      if (previous) {
        queryClient.setQueryData<RoomBoardVM[]>(
          keys.roomsBoard(scope),
          previous.map((r) => (r.id === roomId ? { ...r, housekeepingStatus: status } : r)),
        )
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(keys.roomsBoard(scope), ctx.previous)
    },
    onSettled: async (_d, _e, v) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.roomsBoard(scope) }),
        queryClient.invalidateQueries({ queryKey: keys.rooms(scope) }),
        queryClient.invalidateQueries({ queryKey: keys.roomHistory(scope, v.roomId) }),
        queryClient.invalidateQueries({ queryKey: keys.bookings(scope) }),
      ])
    },
  })
}

export interface RoomHistoryVM {
  id: number
  fromStatus: HousekeepingStatus | null
  toStatus: HousekeepingStatus
  changedAt: string
  changedBy: string | null
}

export function useRoomHistory(roomId: string | undefined) {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.roomHistory(scope, roomId ?? ''),
    enabled: Boolean(roomId),
    queryFn: async (): Promise<RoomHistoryVM[]> => {
      const { data, error } = await supabase
        .from('room_status_history')
        .select('id, from_status, to_status, changed_at, changed_by')
        .eq('room_id', roomId!)
        .order('changed_at', { ascending: false })
        .limit(20)
      if (error) throw toAppError(error)
      return data.map((r) => ({ id: r.id, fromStatus: r.from_status, toStatus: r.to_status, changedAt: r.changed_at, changedBy: r.changed_by }))
    },
  })
}
