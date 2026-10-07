import { useQuery } from '@tanstack/react-query'
import type { PaymentMethod } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { DateStr } from '@/lib/clock'
import { keys } from './keys'
import { useTenant } from './tenant'

export interface DailyReportVM {
  date: DateStr
  arrivals: { expected: number; arrived: number; pending: number; noShow: number }
  departures: { expected: number; left: number; pending: number }
  inHouse: number
  rooms: { total: number; outOfOrder: number; occupied: number }
  revenue: { room: number; other: number; discounts: number; tax: number }
  payments: Partial<Record<PaymentMethod, number>>
  paymentsTotal: number
  outstanding: number
  outstandingCount: number
  newBookings: number
  cancellations: number
  shifts: { id: string; status: string; openedAt: string; closedAt: string | null; discrepancy: Record<string, number> | null }[]
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function useDailyReport(date: DateStr) {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.report(scope, date),
    queryFn: async (): Promise<DailyReportVM> => {
      const { data, error } = await supabase.rpc('daily_report', { p_property_id: scope.propertyId, p_date: date })
      if (error) throw toAppError(error)
      const r = (data ?? {}) as Record<string, any>
      const payments: Partial<Record<PaymentMethod, number>> = {}
      for (const [k, v] of Object.entries(r.payments ?? {})) payments[k as PaymentMethod] = num(v)
      return {
        date: r.date ?? date,
        arrivals: {
          expected: num(r.arrivals?.expected),
          arrived: num(r.arrivals?.arrived),
          pending: num(r.arrivals?.pending),
          noShow: num(r.arrivals?.no_show),
        },
        departures: { expected: num(r.departures?.expected), left: num(r.departures?.left), pending: num(r.departures?.pending) },
        inHouse: num(r.in_house),
        rooms: { total: num(r.rooms?.total), outOfOrder: num(r.rooms?.out_of_order), occupied: num(r.rooms?.occupied) },
        revenue: { room: num(r.revenue?.room), other: num(r.revenue?.other), discounts: num(r.revenue?.discounts), tax: num(r.revenue?.tax) },
        payments,
        paymentsTotal: num(r.payments_total),
        outstanding: num(r.outstanding),
        outstandingCount: num(r.outstanding_count),
        newBookings: num(r.new_bookings),
        cancellations: num(r.cancellations),
        shifts: Array.isArray(r.cash_shifts)
          ? r.cash_shifts.map((s: Record<string, any>) => ({
              id: String(s.id),
              status: String(s.status),
              openedAt: String(s.opened_at),
              closedAt: s.closed_at ? String(s.closed_at) : null,
              discrepancy: s.discrepancy ?? null,
            }))
          : [],
      }
    },
  })
}
