import {
  t,
  type BookingSource,
  type BookingStatus,
  type HousekeepingStatus,
  type MessageKey,
  type PaymentMethod,
} from '@hotel-digital/shared'

export const statusLabel = (s: BookingStatus) => t(`status.${s}` as MessageKey)
export const sourceLabel = (s: BookingSource) => t(`source.${s}` as MessageKey)
export const methodLabel = (m: PaymentMethod) => t(`method.${m}` as MessageKey)
export const hkLabel = (s: HousekeepingStatus) => t(`hk.${s}` as MessageKey)
export const nightsLabel = (n: number) =>
  n === 1 ? t('common.night', { n }) : t('common.nights', { n })
