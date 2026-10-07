// The hotel's clock. Every "today" in the app comes from the property's
// timezone, never from the device: a night receptionist at 01:00 in Karachi
// and an owner checking from London must see the same hotel day.
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

/** A hotel-local calendar date as 'yyyy-MM-dd'. Compares correctly as a string. */
export type DateStr = string

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateStr(value: unknown): value is DateStr {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = parseISO(value)
  return !Number.isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === value
}

export function hotelToday(tz: string, now: Date = new Date()): DateStr {
  return formatInTimeZone(now, tz, 'yyyy-MM-dd')
}

/** [start, end) instants of a hotel day. */
export function hotelDayBounds(tz: string, day: DateStr): { start: Date; end: Date } {
  const start = fromZonedTime(`${day}T00:00:00`, tz)
  const end = fromZonedTime(`${addDaysStr(day, 1)}T00:00:00`, tz)
  return { start, end }
}

export function addDaysStr(day: DateStr, n: number): DateStr {
  return format(addDays(parseISO(day), n), 'yyyy-MM-dd')
}

/** Calendar days from a to b. Never differenceInDays (it rounds partial days). */
export function daysBetween(a: DateStr, b: DateStr): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a))
}

/** Nights of a stay: check-in inclusive, check-out exclusive. */
export const nightsBetween = daysBetween

/** True if the stay occupies the given night (check-in <= night < check-out). */
export function isNightCovered(checkIn: DateStr, checkOut: DateStr, night: DateStr): boolean {
  return checkIn <= night && night < checkOut
}

export const fmtDay = (d: DateStr) => format(parseISO(d), 'EEE') // Tue
export const fmtDayNum = (d: DateStr) => format(parseISO(d), 'd') // 6
export const fmtShort = (d: DateStr) => format(parseISO(d), 'dd MMM') // 06 Oct
export const fmtMedium = (d: DateStr) => format(parseISO(d), 'EEE dd MMM') // Tue 06 Oct
export const fmtLong = (d: DateStr) => format(parseISO(d), 'EEEE, dd MMM yyyy') // Tuesday, 06 Oct 2026
export const fmtFull = (d: DateStr) => format(parseISO(d), 'dd MMM yyyy') // 06 Oct 2026

/** Show a date with the year only when it is not the current hotel year. */
export function fmtSmart(d: DateStr, today: DateStr): string {
  return d.slice(0, 4) === today.slice(0, 4) ? fmtShort(d) : fmtFull(d)
}

/** An instant (ISO timestamptz) rendered in the hotel's timezone. */
export function fmtInstant(iso: string, tz: string, pattern = 'dd MMM, HH:mm'): string {
  return formatInTimeZone(new Date(iso), tz, pattern)
}

/** Relative day label: Today / Tomorrow / Yesterday / weekday+date. */
export function relativeDay(d: DateStr, today: DateStr): 'today' | 'tomorrow' | 'yesterday' | null {
  const diff = daysBetween(today, d)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return null
}
