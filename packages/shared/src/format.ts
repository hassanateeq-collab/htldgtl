import { format } from 'date-fns'

/** Format a PKR amount as "PKR 98,000" (no decimals). */
export function formatPKR(amount: number): string {
  return `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(Math.round(amount))}`
}

/**
 * Canonicalize a Pakistani phone number to +92XXXXXXXXXX (E.164), or null if invalid.
 * Accepts: 03XXXXXXXXX, +923XXXXXXXXX, 00923XXXXXXXXX, 923XXXXXXXXX (spaces/dashes ignored).
 */
export function toPakistanE164(input: string): string | null {
  const s = input.replace(/[^\d+]/g, '')
  if (/^\+92\d{10}$/.test(s)) return s
  let national: string | null = null
  if (/^0092\d{10}$/.test(s)) national = s.slice(4)
  else if (/^92\d{10}$/.test(s)) national = s.slice(2)
  else if (/^0\d{10}$/.test(s)) national = s.slice(1) // 03XXXXXXXXX -> 3XXXXXXXXX
  if (!national || national.length !== 10) return null
  return `+92${national}`
}

/**
 * Mirror of the database's normalize_phone(): E.164 for anything recognisable
 * (Pakistani local forms get +92), otherwise the cleaned digits so the server
 * can reject it. Null for blank input.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input || !input.trim()) return null
  const s = input.trim().replace(/[^\d+]/g, '')
  if (/^\+[1-9]\d{6,14}$/.test(s)) return s
  if (/^00[1-9]\d{6,14}$/.test(s)) return `+${s.slice(2)}`
  if (/^0\d{10}$/.test(s)) return `+92${s.slice(1)}`
  if (/^92\d{10}$/.test(s)) return `+${s}`
  if (/^3\d{9}$/.test(s)) return `+92${s}`
  return s
}

export const isE164 = (s: string) => /^\+[1-9]\d{6,14}$/.test(s)

/** Format a +92 number for display: +92 300 1234567. */
export function formatPhone(e164: string | null): string {
  if (!e164) return ''
  const m = /^\+92(\d{3})(\d{7})$/.exec(e164)
  return m ? `+92 ${m[1]} ${m[2]}` : e164
}

/** CNIC digits → XXXXX-XXXXXXX-X; anything else returned trimmed. */
export function formatCnic(input: string): string {
  const d = input.replace(/\D/g, '')
  if (d.length === 13) return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
  return input.trim()
}

export const isCnic = (s: string) => /^\d{5}-\d{7}-\d$/.test(s)

/** Display a hotel-local date as "dd MMM yyyy". Accepts a Date or ISO date string. */
export function formatHotelDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return format(date, 'dd MMM yyyy')
}
