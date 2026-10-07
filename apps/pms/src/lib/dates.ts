import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'

/** A hotel-local calendar date as 'yyyy-MM-dd'. Compares correctly as a string. */
export type DateStr = string

export function toDateStr(d: Date): DateStr {
  return format(d, 'yyyy-MM-dd')
}

export function fromDateStr(s: DateStr): Date {
  return parseISO(s)
}

export function todayStr(): DateStr {
  return toDateStr(startOfDay(new Date()))
}

export function addDaysStr(s: DateStr, n: number): DateStr {
  return toDateStr(addDays(fromDateStr(s), n))
}

/** Calendar days from `a` to `b` (never differenceInDays — it rounds down on partial days). */
export function daysBetween(a: DateStr, b: DateStr): number {
  return differenceInCalendarDays(fromDateStr(b), fromDateStr(a))
}

/** Nights of a stay: check-in inclusive, check-out exclusive. */
export function nightsBetween(checkIn: DateStr, checkOut: DateStr): number {
  return daysBetween(checkIn, checkOut)
}

/** True if the stay occupies the given night (check-in <= night < check-out). */
export function isNightCovered(checkIn: DateStr, checkOut: DateStr, night: DateStr): boolean {
  return checkIn <= night && night < checkOut
}

export const fmtDay = (s: DateStr) => format(fromDateStr(s), 'EEE') // Tue
export const fmtDayNum = (s: DateStr) => format(fromDateStr(s), 'd') // 6
export const fmtShort = (s: DateStr) => format(fromDateStr(s), 'dd MMM') // 06 Oct
export const fmtLong = (s: DateStr) => format(fromDateStr(s), 'EEEE, dd MMM yyyy') // Tuesday, 06 Oct 2026

/** Display an instant (ISO timestamptz) as a local-time "dd MMM" — never slice the UTC string. */
export const fmtInstantShort = (iso: string) => format(new Date(iso), 'dd MMM')
