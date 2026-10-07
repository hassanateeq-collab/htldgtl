// Every failure the UI shows goes through here: database codes (ADR 0006),
// PostgREST codes and network failures become an AppError with a kind the
// i18n layer knows. Raw messages are kept for logging only.
import { errorKindFromCode, t, type ErrorKind, type MessageKey } from '@hotel-digital/shared'

export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    readonly code: string | null,
    readonly original: string,
  ) {
    super(original || kind)
    this.name = 'AppError'
  }
}

interface ErrorLike {
  code?: unknown
  message?: unknown
  details?: unknown
  name?: unknown
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  const err = (e ?? {}) as ErrorLike
  const code = typeof err.code === 'string' ? err.code : null
  const message = typeof err.message === 'string' ? err.message : String(e ?? '')
  if (err.name === 'TypeError' && /fetch/i.test(message)) return new AppError('offline', null, message)
  if (/booking_rooms_no_overlap/i.test(message)) return new AppError('room_taken', '23P01', message)
  return new AppError(errorKindFromCode(code), code, message)
}

export function errorMessage(e: unknown): string {
  const kind = toAppError(e).kind
  return t(`error.${kind}` as MessageKey)
}

export function isKind(e: unknown, kind: ErrorKind): boolean {
  return toAppError(e).kind === kind
}
