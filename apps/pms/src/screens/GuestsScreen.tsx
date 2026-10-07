import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatPKR, t } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useGuests } from '@/data/queries'
import { owesMoney } from '@/data/types'
import { fmtShort } from '@/lib/dates'

const inputClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface GuestStats {
  stays: number
  lastCheckIn: string | null
  due: number
}

export function GuestsScreen() {
  const { property } = useTenant()
  const guestsQ = useGuests()
  const bookingsQ = useBookings(property.id)
  const [q, setQ] = useState('')

  const stats = useMemo(() => {
    const map = new Map<string, GuestStats>()
    for (const b of bookingsQ.data ?? []) {
      if (!b.guest) continue
      const s = map.get(b.guest.id) ?? { stays: 0, lastCheckIn: null, due: 0 }
      if (b.status !== 'cancelled' && b.status !== 'no_show') {
        s.stays += 1
        if (!s.lastCheckIn || b.checkIn > s.lastCheckIn) s.lastCheckIn = b.checkIn
      }
      if (owesMoney(b)) s.due += b.balance ?? 0
      map.set(b.guest.id, s)
    }
    return map
  }, [bookingsQ.data])

  if (guestsQ.isPending || bookingsQ.isPending) return <Loading />
  const error = guestsQ.error ?? bookingsQ.error
  if (error) return <ErrorNote message={error.message} />

  const term = q.trim().toLowerCase()
  // Phones are stored as +92…; a local "0321…" search must still match, so drop the trunk zero.
  const digits = term.replace(/\D/g, '').replace(/^0/, '')
  const guests = (guestsQ.data ?? []).filter((g) => {
    if (!term) return true
    if (g.name.toLowerCase().includes(term)) return true
    if (digits.length >= 3 && g.phone && g.phone.replace(/\D/g, '').includes(digits)) return true
    return false
  })

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-24 md:max-w-5xl md:px-6 md:py-6 md:pb-8">
      <input
        className={inputClass}
        placeholder={t('guests.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />

      {guests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
          {t('guests.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card text-card-foreground md:grid md:grid-cols-2 md:divide-y-0 md:gap-px md:bg-border">
          {guests.map((g) => {
            const s = stats.get(g.id)
            return (
              <li key={g.id} className="bg-card">
                <Link to={`/guests/${g.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-accent">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        g.phone,
                        s ? (s.stays === 1 ? t('guests.stay') : t('guests.stays', { n: s.stays })) : null,
                        s?.lastCheckIn ? t('guests.lastStay', { date: fmtShort(s.lastCheckIn) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {s && s.due > 0 && (
                    <Badge className="border-red-200 bg-red-50 text-red-700">
                      {t('bookings.due', { amount: formatPKR(s.due) })}
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
