import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { formatPhone, formatPKR, t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { QueryState } from '@/components/patterns/state'
import { useTenant } from '@/data/tenant'
import { useBooking } from '@/data/bookings'
import { useGuest } from '@/data/guests'
import { fmtFull } from '@/lib/clock'
import { idTypeLabel } from '@/lib/labels'

function Line({ label, value, blank }: { label: string; value?: string | null; blank?: boolean }) {
  return (
    <div className="flex items-end gap-3 border-b border-zinc-400 py-2">
      <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="min-h-5 flex-1 text-base">{blank ? '' : value || ''}</span>
    </div>
  )
}

/** The paper registration card Pakistani hotels keep for every stay (Form C details for foreign guests). */
export default function RegistrationCardScreen() {
  const { id } = useParams()
  const { tenant, property, branding } = useTenant()
  const bookingQ = useBooking(id)
  const guestQ = useGuest(bookingQ.data?.guest.id)
  const b = bookingQ.data ?? null
  const g = guestQ.data ?? null
  const legalName = branding?.legalName ?? tenant.name

  return (
    <div className="min-h-svh bg-white text-black">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4 print:hidden">
        <Button variant="ghost" asChild>
          <Link to={b ? `/bookings/${b.id}` : '/bookings'}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
            {t('receipt.back')}
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          {t('receipt.print')}
        </Button>
      </div>
      <QueryState pending={bookingQ.isPending || guestQ.isPending} error={bookingQ.error ?? guestQ.error} skeleton={<Skeleton className="mx-6 h-96" />}>
        {!b ? (
          <EmptyState title={t('booking.notFound')} />
        ) : (
          <article className="mx-auto max-w-2xl px-6 pb-12 print:max-w-none print:px-0">
            <header className="border-b border-zinc-300 pb-4">
              <h1 className="text-xl font-semibold">{legalName}</h1>
              <p className="text-sm text-zinc-600">{[property.name, property.address, property.city].filter(Boolean).join(' · ')}</p>
              <p className="mt-3 text-lg font-semibold uppercase tracking-wide">{t('registration.title')}</p>
              <p className="tnum text-sm text-zinc-600">
                {t('receipt.bookingNo')} {b.bookingNo} · {fmtFull(b.checkIn)}
              </p>
            </header>
            <section className="mt-4">
              <Line label={t('registration.guest')} value={b.guest.name} />
              <Line label={t('registration.idType')} value={g?.idType ? idTypeLabel(g.idType) : ''} />
              <Line label={t('registration.idNumber')} value={g?.idNumber} />
              <Line label={t('registration.nationality')} value={g?.nationality} />
              <Line label={t('registration.address')} value={g?.address} />
              <Line label={t('registration.phone')} value={formatPhone(b.guest.phone)} />
              <Line label={t('registration.arrival')} value={`${fmtFull(b.checkIn)} · ${property.checkInTime}`} />
              <Line label={t('registration.departure')} value={`${fmtFull(b.checkOut)} · ${property.checkOutTime}`} />
              <Line label={t('registration.room')} value={b.room ? `${b.room.label} · ${b.room.typeName}` : ''} />
              <Line label={t('registration.rate')} value={formatPKR(b.nightlyRatePkr)} />
              <Line label={t('registration.guests')} value={`${b.adults} ${t('booking.adults').toLowerCase()}${b.children ? `, ${b.children} ${t('booking.children').toLowerCase()}` : ''}`} />
              <Line label={t('registration.purpose')} blank />
              <Line label={t('registration.comingFrom')} blank />
              <Line label={t('registration.nextDestination')} blank />
              <Line label={t('registration.vehicle')} blank />
            </section>
            <p className="mt-6 text-sm text-zinc-600">{t('registration.declaration')}</p>
            <footer className="mt-12 grid grid-cols-2 gap-10 text-sm text-zinc-600">
              <div className="border-t border-zinc-400 pt-2">{t('registration.signature')}</div>
              <div className="border-t border-zinc-400 pt-2">{t('registration.staff')}</div>
            </footer>
          </article>
        )}
      </QueryState>
    </div>
  )
}
