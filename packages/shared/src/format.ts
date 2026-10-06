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

/** Display a hotel-local date as "dd MMM yyyy". Accepts a Date or ISO date string. */
export function formatHotelDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return format(date, 'dd MMM yyyy')
}
