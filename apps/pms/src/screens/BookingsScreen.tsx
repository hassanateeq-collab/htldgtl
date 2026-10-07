import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { formatPKR, t, type MessageKey } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState, SkeletonRows } from '@/components/ui/feedback'
import { Page, PageHeader, SectionTitle } from '@/components/patterns/Page'
import { BookingRow } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useHotelToday } from '@/data/tenant'
import { BOOKING_FILTERS, useBookingsList, type BookingFilter } from '@/data/bookings'
import type { BookingVM } from '@/data/types'
import { daysBetween } from '@/lib/clock'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'

const FILTER_LABEL: Record<BookingFilter, MessageKey> = {
  all: 'bookings.filter.all',
  arriving: 'bookings.filter.arriving',
  inHouse: 'bookings.filter.inHouse',
  departing: 'bookings.filter.departing',
  upcoming: 'bookings.filter.upcoming',
  due: 'bookings.filter.due',
  past: 'bookings.filter.past',
  cancelled: 'bookings.filter.cancelled',
}

type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'earlier'
const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'earlier']

function groupOf(b: BookingVM, today: string): GroupKey {
  if (b.status === 'confirmed' && b.checkIn < today) return 'overdue'
  if (b.status === 'checked_in' && b.checkOut < today) return 'overdue'
  const d = daysBetween(today, b.checkIn)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d > 1 && d <= 7) return 'week'
  if (d > 7) return 'later'
  return 'earlier'
}

export default function BookingsScreen() {
  const today = useHotelToday()
  const [params, setParams] = useSearchParams()
  const filterParam = params.get('filter') as BookingFilter | null
  const filter: BookingFilter = filterParam && BOOKING_FILTERS.includes(filterParam) ? filterParam : 'all'
  const [q, setQ] = useState(params.get('q') ?? '')
  const deferredQ = useDebounced(q.trim(), 250)
  const listQ = useBookingsList(filter, deferredQ)

  const rows = useMemo(() => listQ.data?.pages.flatMap((p) => p.rows) ?? [], [listQ.data])
  const grouped = filter === 'all' || filter === 'upcoming'
  const groups = useMemo(() => {
    if (!grouped) return null
    const map = new Map<GroupKey, BookingVM[]>()
    for (const b of rows) {
      const k = groupOf(b, today)
      map.set(k, [...(map.get(k) ?? []), b])
    }
    return GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({ key: k, rows: map.get(k)! }))
  }, [rows, grouped, today])
  const totalDue = filter === 'due' ? rows.reduce((s, b) => s + Math.max(b.folio?.balance ?? 0, 0), 0) : 0

  function setFilter(next: BookingFilter) {
    const p = new URLSearchParams(params)
    if (next === 'all') p.delete('filter')
    else p.set('filter', next)
    setParams(p, { replace: true })
  }

  return (
    <Page width="lg">
      <PageHeader title={t('bookings.title')} subtitle={filter === 'due' && rows.length ? t('bookings.totalDue', { amount: formatPKR(totalDue) }) : undefined} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('bookings.search')}
          aria-label={t('bookings.search')}
          className="pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
          enterKeyHint="search"
          autoComplete="off"
        />
        {q && (
          <Button variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={t('common.clear')} onClick={() => setQ('')}>
            <X className="h-5 w-5" aria-hidden />
          </Button>
        )}
      </div>

      <Segmented ariaLabel={t('bookings.title')} value={filter} onChange={setFilter} options={BOOKING_FILTERS.map((f) => ({ value: f, label: t(FILTER_LABEL[f]) }))} />

      {filter === 'due' && rows.length > 0 && <p className="text-base font-semibold text-due md:hidden">{t('bookings.totalDue', { amount: formatPKR(totalDue) })}</p>}

      <QueryState pending={listQ.isPending} error={listQ.error} onRetry={() => void listQ.refetch()} skeleton={<SkeletonRows rows={6} />}>
        {rows.length === 0 ? (
          <EmptyState title={deferredQ ? t('bookings.emptySearch', { q: deferredQ }) : filter === 'all' ? t('bookings.empty') : t('bookings.emptyFiltered')} />
        ) : groups ? (
          <div className={cn('space-y-5 transition-opacity', listQ.isPlaceholderData && 'opacity-60')} aria-busy={listQ.isPlaceholderData}>
            {groups.map((g) => (
              <section key={g.key} className="space-y-2">
                <SectionTitle count={g.rows.length}>
                  <span className={g.key === 'overdue' ? 'text-warning' : undefined}>{t(`bookings.group.${g.key}`)}</span>
                </SectionTitle>
                <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
                  {g.rows.map((b) => (
                    <BookingRow key={b.id} booking={b} today={today} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={cn('space-y-2 transition-opacity md:grid md:grid-cols-2 md:gap-2 md:space-y-0', listQ.isPlaceholderData && 'opacity-60')} aria-busy={listQ.isPlaceholderData}>
            {rows.map((b) => (
              <BookingRow key={b.id} booking={b} today={today} />
            ))}
          </div>
        )}
        {listQ.hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => void listQ.fetchNextPage()} loading={listQ.isFetchingNextPage}>
              {t('bookings.loadMore')}
            </Button>
          </div>
        )}
      </QueryState>
    </Page>
  )
}
