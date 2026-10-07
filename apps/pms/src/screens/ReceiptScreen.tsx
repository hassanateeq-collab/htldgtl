import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { formatPKR, t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useBranding, useFolio } from '@/data/queries'
import { fmtInstantShort, fmtLong, fmtShort, nightsBetween, todayStr } from '@/lib/dates'
import { methodLabel, nightsLabel } from '@/lib/labels'

/** Print-friendly folio receipt. Rendered outside the app shell. */
export function ReceiptScreen() {
  const { id } = useParams()
  const { tenant, property } = useTenant()
  const bookingsQ = useBookings(property.id)
  const folioQ = useFolio(id)
  const brandingQ = useBranding(tenant.id)

  if (bookingsQ.isPending || folioQ.isPending || brandingQ.isPending) return <Loading />
  const error = bookingsQ.error ?? folioQ.error ?? brandingQ.error
  if (error) return <ErrorNote message={error.message} />

  const booking = (bookingsQ.data ?? []).find((b) => b.id === id)
  const folio = folioQ.data ?? null
  const branding = brandingQ.data ?? null
  if (!booking) return <ErrorNote message={t('booking.notFound')} />

  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const balance = folio?.balance ?? 0
  const legalName = branding?.legalName ?? tenant.name
  const address = branding?.address ?? [property.address, property.city].filter(Boolean).join(', ')

  return (
    <div className="min-h-svh bg-white text-black">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4 print:hidden">
        <Link to={`/bookings/${booking.id}`} className="inline-flex items-center gap-1 text-sm text-zinc-600">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t('receipt.back')}
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          {t('receipt.print')}
        </Button>
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-12 print:px-0">
        <header className="flex items-start justify-between gap-6 border-b border-zinc-300 pb-4">
          <div>
            <h1 className="text-xl font-semibold">{legalName}</h1>
            {legalName !== property.name && <p className="text-sm text-zinc-700">{property.name}</p>}
            {address && <p className="text-sm text-zinc-600">{address}</p>}
            {(branding?.ntn || branding?.strn) && (
              <p className="text-xs text-zinc-500">
                {branding?.ntn ? `${t('receipt.ntn')} ${branding.ntn}` : ''}
                {branding?.ntn && branding?.strn ? ' · ' : ''}
                {branding?.strn ? `${t('receipt.strn')} ${branding.strn}` : ''}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold uppercase tracking-wide">{t('receipt.title')}</p>
            <p className="text-sm text-zinc-600">
              {t('receipt.bookingNo')} {booking.bookingNo}
            </p>
            <p className="text-xs text-zinc-500">
              {t('receipt.issued')} {fmtLong(todayStr())}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{t('receipt.guest')}</p>
            <p className="font-medium">{booking.guest?.name ?? '—'}</p>
            {booking.guest?.phone && <p className="text-zinc-600">{booking.guest.phone}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{t('receipt.stay')}</p>
            <p className="font-medium">
              {booking.roomLabel ?? '—'} · {booking.roomTypeName ?? ''}
            </p>
            <p className="text-zinc-600">
              {fmtShort(booking.checkIn)} → {fmtShort(booking.checkOut)} · {nightsLabel(nights)}
            </p>
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-2 font-medium">{t('receipt.date')}</th>
              <th className="py-2 pr-2 font-medium">{t('receipt.description')}</th>
              <th className="py-2 pl-2 text-right font-medium">{t('receipt.charges')}</th>
              <th className="py-2 pl-2 text-right font-medium">{t('receipt.payments')}</th>
            </tr>
          </thead>
          <tbody>
            {(folio?.items ?? []).map((item) => {
              const isMoneyIn = item.kind === 'payment' || item.kind === 'refund'
              const kindName = t(`kind.${item.kind}`)
              const label = isMoneyIn
                ? `${item.description && item.description !== kindName ? item.description : kindName} · ${methodLabel(item.method ?? 'cash')}${item.reference ? ` · ${item.reference}` : ''}`
                : item.kind === 'discount'
                  ? `${kindName} · ${item.description}`
                  : item.description
              // Discounts and refunds reduce their column: "− PKR 3,000", same as the folio view.
              const amount =
                item.kind === 'discount' || item.kind === 'refund' ? `− ${formatPKR(item.amountPkr)}` : formatPKR(item.amountPkr)
              return (
                <tr key={item.id} className="border-b border-zinc-200">
                  <td className="py-2 pr-2 text-zinc-600">{fmtInstantShort(item.postedAt)}</td>
                  <td className="py-2 pr-2">{label}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{!isMoneyIn ? amount : ''}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{isMoneyIn ? amount : ''}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-3 text-right text-zinc-600">
                {t('receipt.totalCharges')}
              </td>
              <td className="pt-3 text-right font-medium tabular-nums">{formatPKR(folio?.totalCharges ?? 0)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={2} className="pt-1 text-right text-zinc-600">
                {t('receipt.totalPaid')}
              </td>
              <td />
              <td className="pt-1 text-right font-medium tabular-nums">{formatPKR(folio?.totalPayments ?? 0)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="pt-3 text-right text-base font-semibold">
                {balance > 0 ? t('receipt.balance') : t('receipt.paid')}
              </td>
              <td colSpan={2} className="pt-3 text-right text-base font-semibold tabular-nums">
                {formatPKR(Math.max(balance, 0))}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-10 text-center text-sm text-zinc-500">{t('receipt.thanks')}</p>
      </div>
    </div>
  )
}
