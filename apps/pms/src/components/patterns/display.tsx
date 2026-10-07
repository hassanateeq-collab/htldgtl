import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, Check, CircleAlert, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
import { formatPKR, t, tNights, type BookingStatus, type HousekeepingStatus } from '@hotel-digital/shared'
import { cn } from '@/lib/utils'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { hkLabel, hkTone, statusLabel, statusTone } from '@/lib/labels'
import { fmtShort, fmtSmart, type DateStr } from '@/lib/clock'
import type { BookingVM } from '@/data/types'

// ----------------------------------------------------------------- money ----
export function Money({ amount, className, signed }: { amount: number; className?: string; signed?: boolean }) {
  const prefix = signed ? (amount < 0 ? '− ' : amount > 0 ? '+ ' : '') : amount < 0 ? '− ' : ''
  return (
    <span className={cn('tnum', className)}>
      {prefix}
      {formatPKR(Math.abs(amount))}
    </span>
  )
}

/** The folio position in words: "Balance due PKR X" / "Credit PKR X" / "Settled". */
export function BalanceText({ amount, size = 'md' }: { amount: number; size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-2xl font-semibold' : 'text-base font-semibold'
  if (amount > 0) {
    return (
      <span className={cn(cls, 'text-due')}>
        {t('booking.balance')} · <Money amount={amount} />
      </span>
    )
  }
  if (amount < 0) {
    return (
      <span className={cn(cls, 'text-credit')}>
        {t('booking.credit')} · <Money amount={-amount} />
      </span>
    )
  }
  return <span className={cn(cls, 'text-settled')}>{t('booking.settled')}</span>
}

export function BalanceBadge({ amount, status }: { amount: number; status: BookingStatus }) {
  if (status === 'cancelled' || status === 'no_show') return null
  if (amount > 0) return <Badge tone="due">{t('bookings.due', { amount: formatPKR(amount) })}</Badge>
  if (amount < 0) return <Badge tone="credit">{t('bookings.credit', { amount: formatPKR(-amount) })}</Badge>
  return null
}

// ---------------------------------------------------------------- badges ----
export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel(status)}</Badge>
}

const hkIcon: Record<HousekeepingStatus, LucideIcon> = {
  clean: Check,
  inspected: Sparkles,
  dirty: CircleAlert,
  out_of_order: Wrench,
}

export function HkBadge({ status, className }: { status: HousekeepingStatus; className?: string }) {
  const Icon = hkIcon[status]
  return (
    <Badge tone={hkTone[status]} className={className}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {hkLabel(status)}
    </Badge>
  )
}

export function Tone({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <Badge tone={tone} className={className}>
      {children}
    </Badge>
  )
}

// ------------------------------------------------------------------ KPI ----
interface KpiProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  to?: string
  tone?: 'default' | 'due' | 'success'
  /** Smaller value type for long strings such as money, so the figure never wraps. */
  compact?: boolean
}

export function KpiTile({ label, value, sub, to, tone = 'default', compact }: KpiProps) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'tnum mt-1 whitespace-nowrap font-semibold leading-none',
          compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl',
          tone === 'due' && 'text-due',
          tone === 'success' && 'text-settled',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </>
  )
  const cls = 'block rounded-lg border border-border bg-card p-3 text-card-foreground md:p-4'
  return to ? (
    <Link to={to} className={cn(cls, 'transition-colors hover:bg-accent/60 active:bg-accent')}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

// ----------------------------------------------------------- booking row ----
interface BookingRowProps {
  booking: BookingVM
  today: DateStr
  /** Trailing quick action, e.g. a Check in button. */
  action?: ReactNode
  /** Secondary line override (defaults to dates · nights). */
  note?: ReactNode
  hideStatus?: boolean
}

export function BookingRow({ booking: b, today, action, note, hideStatus }: BookingRowProps) {
  return (
    <Card className={cn('flex items-stretch', b.status === 'cancelled' && 'opacity-70')}>
      <Link to={`/bookings/${b.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-3 active:bg-accent">
        <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-muted text-center">
          <span className="tnum text-base font-semibold leading-none">{b.room?.label ?? '—'}</span>
          <span className="mt-0.5 line-clamp-1 px-1 text-[11px] leading-none text-muted-foreground">{b.room?.typeName.split(' ')[0] ?? ''}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">{b.guest.name}</p>
          <p className={cn('tnum text-sm text-muted-foreground', note ? 'line-clamp-2' : 'truncate')}>
            {note ?? (
              <>
                {fmtSmart(b.checkIn, today)} → {fmtSmart(b.checkOut, today)} · {tNights(b.nights)}
              </>
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {!hideStatus && <StatusBadge status={b.status} />}
            <BalanceBadge amount={b.folio?.balance ?? 0} status={b.status} />
            {!b.guest.hasId && (b.status === 'confirmed' || b.status === 'checked_in') && <Badge tone="warning">{t('booking.noId')}</Badge>}
          </div>
        </div>
      </Link>
      {action && <div className="flex items-center pr-3">{action}</div>}
    </Card>
  )
}

export function RoomPill({ label, type }: { label: string; type?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <BedDouble className="h-4 w-4" aria-hidden />
      <span className="tnum font-medium text-foreground">{label}</span>
      {type && <span>· {type}</span>}
    </span>
  )
}

export function DateRange({ from, to, today }: { from: DateStr; to: DateStr; today?: DateStr }) {
  return (
    <span className="tnum">
      {today ? fmtSmart(from, today) : fmtShort(from)} → {today ? fmtSmart(to, today) : fmtShort(to)}
    </span>
  )
}
