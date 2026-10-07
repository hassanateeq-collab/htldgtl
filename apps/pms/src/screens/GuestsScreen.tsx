import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search, X } from 'lucide-react'
import { formatPhone, formatPKR, t } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, SkeletonRows } from '@/components/ui/feedback'
import { Page, PageHeader } from '@/components/patterns/Page'
import { QueryState } from '@/components/patterns/state'
import { useHotelToday } from '@/data/tenant'
import { useGuestsList } from '@/data/guests'
import { fmtSmart } from '@/lib/clock'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'

export default function GuestsScreen() {
  const today = useHotelToday()
  const [q, setQ] = useState('')
  const deferred = useDebounced(q.trim(), 250)
  const listQ = useGuestsList(deferred)
  const guests = listQ.data ?? []

  return (
    <Page width="lg">
      <PageHeader title={t('guests.title')} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('guests.search')}
          aria-label={t('guests.search')}
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

      <QueryState pending={listQ.isPending} error={listQ.error} onRetry={() => void listQ.refetch()} skeleton={<SkeletonRows rows={6} />}>
        {guests.length === 0 ? (
          <EmptyState title={deferred ? t('guests.emptySearch', { q: deferred }) : t('guests.empty')} />
        ) : (
          <Card className={cn('transition-opacity', listQ.isPlaceholderData && 'opacity-60')} aria-busy={listQ.isPlaceholderData}>
            <ul className="divide-y divide-border md:grid md:grid-cols-2 md:divide-y-0 md:gap-px md:bg-border">
              {guests.map((g) => (
                <li key={g.id} className="bg-card">
                  <Link to={`/guests/${g.id}`} className="flex min-h-touch items-center gap-3 px-4 py-3 hover:bg-accent/60 active:bg-accent">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 truncate text-base font-medium">{g.name}</p>
                        {g.inHouse && <Badge tone="inhouse" className="shrink-0">{t('guests.inHouse')}</Badge>}
                      </div>
                      <p className="tnum truncate text-sm text-muted-foreground">
                        {[formatPhone(g.phone), g.stays === 0 ? t('guests.noStays') : g.stays === 1 ? t('guests.stay') : t('guests.stays', { n: g.stays }), g.lastCheckIn ? t('guests.lastStay', { date: fmtSmart(g.lastCheckIn, today) }) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {(g.due > 0 || !g.hasId) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {g.due > 0 && <Badge tone="due">{t('bookings.due', { amount: formatPKR(g.due) })}</Badge>}
                          {!g.hasId && <Badge tone="warning">{t('guests.noId')}</Badge>}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </QueryState>
    </Page>
  )
}
