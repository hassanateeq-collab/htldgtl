// Folio read model and the append-only actions: post an item, void (manager),
// reopen / close (manager). Totals come from the database, never summed here.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaymentMethod } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { keys } from './keys'
import { useTenant } from './tenant'
import type { FolioCategory, FolioItemKind, FolioItemVM, FolioVM } from './types'

export function useFolio(bookingId: string | undefined) {
  const { scope } = useTenant()
  return useQuery({
    queryKey: keys.folio(scope, bookingId ?? ''),
    enabled: Boolean(bookingId),
    queryFn: async (): Promise<FolioVM | null> => {
      const { data, error } = await supabase
        .from('folios')
        .select(
          'id, folio_no, status, total_charges, total_tax, total_payments, balance, items:folio_items(id, kind, category, source, description, amount_pkr, tax_pkr, method, reference, receipt_no, service_date, business_date, posted_at, posted_by, voided_at, void_reason)',
        )
        .eq('booking_id', bookingId!)
        .maybeSingle()
      if (error) throw toAppError(error)
      if (!data) return null
      const items: FolioItemVM[] = data.items
        .map((i) => ({
          id: i.id,
          kind: i.kind as FolioItemKind,
          category: i.category as FolioCategory,
          source: i.source as FolioItemVM['source'],
          description: i.description,
          amountPkr: Number(i.amount_pkr),
          taxPkr: Number(i.tax_pkr),
          method: i.method as PaymentMethod | null,
          reference: i.reference,
          receiptNo: i.receipt_no,
          serviceDate: i.service_date,
          businessDate: i.business_date,
          postedAt: i.posted_at,
          postedBy: i.posted_by,
          voidedAt: i.voided_at,
          voidReason: i.void_reason,
        }))
        .sort((a, b) => (a.serviceDate ?? a.postedAt).localeCompare(b.serviceDate ?? b.postedAt) || a.postedAt.localeCompare(b.postedAt))
      return {
        id: data.id,
        no: data.folio_no,
        status: data.status,
        totalCharges: Number(data.total_charges),
        totalTax: Number(data.total_tax),
        totalPayments: Number(data.total_payments),
        balance: Number(data.balance),
        items,
      }
    },
  })
}

function useInvalidateFolio() {
  const queryClient = useQueryClient()
  const { scope } = useTenant()
  return async (bookingId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.folio(scope, bookingId) }),
      queryClient.invalidateQueries({ queryKey: keys.bookings(scope) }),
      queryClient.invalidateQueries({ queryKey: keys.roomsBoard(scope) }),
      queryClient.invalidateQueries({ queryKey: keys.guests(scope) }),
      queryClient.invalidateQueries({ queryKey: keys.cash(scope) }),
      queryClient.invalidateQueries({ queryKey: keys.activity(scope, bookingId) }),
    ])
  }
}

export interface NewFolioItem {
  bookingId: string
  folioId: string
  kind: FolioItemKind
  category: FolioCategory
  description: string
  amountPkr: number
  method: PaymentMethod | null
  reference: string | null
}

export function usePostFolioItem() {
  const invalidate = useInvalidateFolio()
  const { scope } = useTenant()
  return useMutation({
    mutationFn: async (item: NewFolioItem) => {
      // tenant/property are re-derived from the folio by the prepare trigger; sent here to satisfy NOT NULL typing.
      const { error } = await supabase.from('folio_items').insert({
        tenant_id: scope.tenantId,
        property_id: scope.propertyId,
        folio_id: item.folioId,
        kind: item.kind,
        category: item.category,
        description: item.description,
        amount_pkr: item.amountPkr,
        method: item.method,
        reference: item.reference,
      })
      if (error) throw toAppError(error)
    },
    onSuccess: (_d, v) => invalidate(v.bookingId),
  })
}

export function useVoidFolioItem() {
  const invalidate = useInvalidateFolio()
  return useMutation({
    mutationFn: async ({ itemId, reason }: { bookingId: string; itemId: string; reason: string }) => {
      const { error } = await supabase.rpc('void_folio_item', { p_item_id: itemId, p_reason: reason })
      if (error) throw toAppError(error)
    },
    onSuccess: (_d, v) => invalidate(v.bookingId),
  })
}

export function useReopenFolio() {
  const invalidate = useInvalidateFolio()
  return useMutation({
    mutationFn: async ({ folioId, reason }: { bookingId: string; folioId: string; reason: string }) => {
      const { error } = await supabase.rpc('reopen_folio', { p_folio_id: folioId, p_reason: reason })
      if (error) throw toAppError(error)
    },
    onSuccess: (_d, v) => invalidate(v.bookingId),
  })
}

export function useCloseFolio() {
  const invalidate = useInvalidateFolio()
  return useMutation({
    mutationFn: async ({ folioId }: { bookingId: string; folioId: string }) => {
      const { error } = await supabase.rpc('close_folio', { p_folio_id: folioId })
      if (error) throw toAppError(error)
    },
    onSuccess: (_d, v) => invalidate(v.bookingId),
  })
}
