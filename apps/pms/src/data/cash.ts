// Cash shifts: the open shift (with what the drawer should hold), history, and
// the open / hand over / confirm RPCs.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database, PaymentMethod } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { keys } from './keys'
import { useTenant } from './tenant'
import type { CashShiftVM } from './types'

type ShiftRow = Database['public']['Tables']['cash_shifts']['Row']
type Amounts = Partial<Record<PaymentMethod, number>>

function toAmounts(v: unknown): Amounts | null {
  if (!v || typeof v !== 'object') return null
  const out: Amounts = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k as PaymentMethod] = Number(val)
  return out
}

function toShiftVM(r: ShiftRow): CashShiftVM {
  return {
    id: r.id,
    shiftDate: r.shift_date,
    status: r.status,
    openingFloat: Number(r.opening_float),
    openedBy: r.opened_by,
    openedAt: r.opened_at,
    declared: toAmounts(r.declared) ?? {},
    expected: toAmounts(r.expected),
    confirmed: toAmounts(r.confirmed),
    discrepancy: toAmounts(r.discrepancy),
    closedBy: r.closed_by,
    closedAt: r.closed_at,
    confirmedBy: r.confirmed_by,
    confirmedAt: r.confirmed_at,
    notes: r.notes,
  }
}

/** The open shift (if any) plus the live expected amounts, and the latest handed-over shift awaiting confirmation. */
export function useCurrentShift() {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.cashCurrent(scope),
    refetchInterval: 60_000,
    queryFn: async (): Promise<{ open: CashShiftVM | null; expected: Amounts | null; awaiting: CashShiftVM | null }> => {
      const { data, error } = await supabase
        .from('cash_shifts')
        .select('*')
        .eq('property_id', scope.propertyId)
        .in('status', ['open', 'handed_over'])
        .order('opened_at', { ascending: false })
      if (error) throw toAppError(error)
      const open = data.find((r) => r.status === 'open') ?? null
      const awaiting = data.find((r) => r.status === 'handed_over') ?? null
      let expected: Amounts | null = null
      if (open) {
        const { data: exp, error: expError } = await supabase.rpc('_shift_expected', { p_shift_id: open.id })
        if (expError) throw toAppError(expError)
        expected = toAmounts(exp)
      }
      return { open: open ? toShiftVM(open) : null, expected, awaiting: awaiting ? toShiftVM(awaiting) : null }
    },
  })
}

export function useShiftHistory() {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.cashHistory(scope),
    queryFn: async (): Promise<CashShiftVM[]> => {
      const { data, error } = await supabase
        .from('cash_shifts')
        .select('*')
        .eq('property_id', scope.propertyId)
        .order('opened_at', { ascending: false })
        .limit(30)
      if (error) throw toAppError(error)
      return data.map(toShiftVM)
    },
  })
}

function useInvalidateCash() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return () => queryClient.invalidateQueries({ queryKey: keys.cash(scope) })
}

export function useOpenShift() {
  const { scope } = useTenant()
  const invalidate = useInvalidateCash()
  return useMutation({
    mutationFn: async ({ openingFloat, notes }: { openingFloat: number; notes: string | null }) => {
      const { data, error } = await supabase.rpc('open_cash_shift', {
        p_property_id: scope.propertyId,
        p_opening_float: openingFloat,
        p_notes: notes ?? undefined,
      })
      if (error) throw toAppError(error)
      return data
    },
    onSuccess: () => invalidate(),
  })
}

export function useCloseShift() {
  const invalidate = useInvalidateCash()
  return useMutation({
    mutationFn: async ({ shiftId, declared, notes }: { shiftId: string; declared: Amounts; notes: string | null }) => {
      const { data, error } = await supabase.rpc('close_cash_shift', {
        p_shift_id: shiftId,
        p_declared: declared,
        p_notes: notes ?? undefined,
      })
      if (error) throw toAppError(error)
      return data
    },
    onSuccess: () => invalidate(),
  })
}

export function useConfirmShift() {
  const invalidate = useInvalidateCash()
  return useMutation({
    mutationFn: async ({ shiftId, confirmed, notes }: { shiftId: string; confirmed: Amounts; notes: string | null }) => {
      const { data, error } = await supabase.rpc('confirm_cash_shift', {
        p_shift_id: shiftId,
        p_confirmed: confirmed,
        p_notes: notes ?? undefined,
      })
      if (error) throw toAppError(error)
      return data
    },
    onSuccess: () => invalidate(),
  })
}
