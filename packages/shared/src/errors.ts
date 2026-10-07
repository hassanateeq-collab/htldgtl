// Stable error codes raised by the database functions (ADR 0006). The app maps
// `error.code` to a message key; it never shows message text to staff.
export const ERROR_CODES = {
  HD001: 'balance_due',
  HD002: 'credit_balance',
  HD003: 'bad_transition',
  HD005: 'bad_dates',
  HD006: 'id_required',
  HD007: 'folio_closed',
  HD008: 'room_unavailable',
  HD009: 'deposit_method',
  HD011: 'guest_required',
  HD012: 'cash_shift',
  HD013: 'membership_rule',
  HD014: 'plan_limit',
  HD015: 'void_rule',
  '42501': 'forbidden',
  P0002: 'not_found',
  PGRST116: 'not_found',
  '23P01': 'room_taken',
  '23505': 'duplicate',
  '23514': 'invalid',
  '23503': 'in_use',
} as const

export type ErrorKind = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | 'offline' | 'unknown'

export function errorKindFromCode(code: string | undefined | null): ErrorKind {
  if (!code) return 'unknown'
  return (ERROR_CODES as Record<string, ErrorKind>)[code] ?? 'unknown'
}
