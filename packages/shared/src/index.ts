// Shared constants and types — the single source of truth for both apps and (by
// mirroring) the database. See docs/architecture/feature-flags.md and data-model.md.

export * from './format'
export * from './i18n'
export * from './permissions'
export * from './errors'
export type { Database, Json } from './database.types'

// --- Feature keys (mirrored by a DB check constraint on platform_features.key) ---
export const CORE_FEATURES = [
  'core.frontdesk',
  'core.bookings',
  'core.guests',
  'core.folio',
  'core.housekeeping',
  'core.reports.daily',
  'core.cash_handover',
] as const

export const ADDON_FEATURES = [
  'addon.channel_wubook',
  'addon.whatsapp',
  'addon.booking_engine',
  'addon.multi_property',
  'addon.rate_plans',
  'addon.invoicing',
  'addon.expenses',
  'addon.custom_fields',
] as const

export const FEATURE_KEYS = [...CORE_FEATURES, ...ADDON_FEATURES] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

// --- Roles (per tenant; fixed permission matrix lives in code) ---
export const TENANT_ROLES = [
  'owner',
  'manager',
  'front_desk',
  'housekeeping',
  'accounts',
  'read_only',
] as const
export type TenantRole = (typeof TENANT_ROLES)[number]

// --- Subscription states (ADR 0004) ---
export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'read_only',
  'suspended',
  'cancelled',
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export type AccessLevel = 'full' | 'read_only' | 'none'

// --- Payment rails (manual collection; billing.md) ---
export const PAYMENT_METHODS = [
  'bank_transfer',
  'raast',
  'jazzcash',
  'easypaisa',
  'cash',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

// --- Housekeeping (rooms.housekeeping_status) ---
export const HOUSEKEEPING_STATUSES = ['clean', 'dirty', 'inspected', 'out_of_order'] as const
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number]

// --- Bookings ---
export const BOOKING_STATUSES = [
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_SOURCES = [
  'walk_in',
  'phone',
  'whatsapp',
  'ota',
  'direct',
] as const
export type BookingSource = (typeof BOOKING_SOURCES)[number]
