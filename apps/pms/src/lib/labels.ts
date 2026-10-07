import {
  t,
  type BookingSource,
  type BookingStatus,
  type HousekeepingStatus,
  type PaymentMethod,
  type TenantRole,
} from '@hotel-digital/shared'
import type { BadgeTone } from '@/components/ui/badge'
import type { FolioCategory, FolioItemKind, IdType } from '@/data/types'

export const statusLabel = (s: BookingStatus) => t(`status.${s}`)
export const sourceLabel = (s: BookingSource) => t(`source.${s}`)
export const methodLabel = (m: PaymentMethod) => t(`method.${m}`)
export const hkLabel = (s: HousekeepingStatus) => t(`hk.${s}`)
export const roleLabel = (r: TenantRole) => t(`role.${r}`)
export const kindLabel = (k: FolioItemKind) => t(`kind.${k}`)
export const categoryLabel = (c: FolioCategory) => t(`category.${c}`)
export const idTypeLabel = (i: IdType) => t(`idType.${i}`)

export const statusTone: Record<BookingStatus, BadgeTone> = {
  confirmed: 'confirmed',
  checked_in: 'inhouse',
  checked_out: 'departed',
  cancelled: 'cancelled',
  no_show: 'noshow',
}

export const hkTone: Record<HousekeepingStatus, BadgeTone> = {
  clean: 'hk-clean',
  inspected: 'hk-inspected',
  dirty: 'hk-dirty',
  out_of_order: 'hk-ooo',
}
