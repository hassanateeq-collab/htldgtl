import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { formatPhone, formatPKR, t, tNights } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { QueryState } from '@/components/patterns/state'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useBooking } from '@/data/bookings'
import { useFolio } from '@/data/folio'
import type { FolioItemVM } from '@/data/types'
import { fmtFull, fmtInstant, fmtShort } from '@/lib/clock'
import { categoryLabel, kindLabel, methodLabel } from '@/lib/labels'

/** Print-friendly receipt (closed folio) or statement (open folio). A5 / 80 mm via print CSS. */
export default function ReceiptScreen() {
  const { id } = useParams()
  const { tenant, property, branding, settings } = useTenant()
  const today = useHotelToday()
  const bookingQ = useBooking(id)
  const folioQ = useFolio(id)
  const b = bookingQ.data ?? null
  const folio = folioQ.data ?? null
  const [printedAt] = useState(() => new Date().toISOString())

  const legalName = branding?.legalName ?? tenant.name
  const address = [property.address, property.city].filter(Boolean).join(', ')
  const closed = folio?.status === 'closed'
  const title = closed ? t('receipt.title') : t('receipt.statement')
  const lastPayment = folio?.items.filter((i) => (i.kind === 'payment' || i.kind === 'refund') && !i.voidedAt).sort((a, c) => c.postedAt.localeCompare(a.postedAt))[0]
  const issued = closed ? (lastPayment ? fmtInstant(lastPayment.postedAt, property.timezone, 'dd MMM yyyy') : fmtFull(today)) : fmtFull(today)
  const items = (folio?.items ?? []).filter((i) => !i.voidedAt)
  const nights = items.filter((i) => i.kind === 'charge' && i.category === 'room' && i.source === 'auto')
  const others = items.filter((i) => !(i.kind === 'charge' && i.category === 'room' && i.source === 'auto'))

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

      <QueryState pending={bookingQ.isPending || folioQ.isPending} error={bookingQ.error ?? folioQ.error} skeleton={<Skeleton className="mx-6 h-96" />}>
        {!b ? (
          <EmptyState title={t('booking.notFound')} />
        ) : (
          <article className="mx-auto max-w-2xl px-4 pb-12 text-[14px] sm:px-6 sm:text-[15px] print:max-w-none print:px-0">
            <header className="flex items-start justify-between gap-6 border-b border-zinc-300 pb-4">
              <div className="flex items-start gap-3">
                {branding?.logoUrl && <img src={branding.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />}
                <div>
                  <h1 className="text-xl font-semibold">{legalName}</h1>
                  {legalName !== property.name && <p className="text-sm text-zinc-700">{property.name}</p>}
                  {address && <p className="text-sm text-zinc-600">{address}</p>}
                  {property.phone && <p className="text-sm text-zinc-600">{formatPhone(property.phone)}</p>}
                  {(property.ntn || property.strn) && (
                    <p className="text-xs text-zinc-500">
                      {property.ntn ? `${t('receipt.ntn')} ${property.ntn}` : ''}
                      {property.ntn && property.strn ? ' · ' : ''}
                      {property.strn ? `${t('receipt.strn')} ${property.strn}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0 whitespace-nowrap text-right">
                <p className="text-lg font-semibold uppercase tracking-wide">{title}</p>
                <p className="tnum text-sm text-zinc-600">
                  {t('receipt.bookingNo')} {b.bookingNo}
                </p>
                {folio?.no && (
                  <p className="tnum text-sm text-zinc-600">
                    {t('receipt.folioNo')} {folio.no}
                  </p>
                )}
                <p className="tnum text-xs text-zinc-500">
                  {t('receipt.issued')} {issued}
                </p>
              </div>
            </header>

            <section className="grid grid-cols-2 gap-6 py-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">{t('receipt.guest')}</p>
                <p className="font-medium">{b.guest.name}</p>
                {b.guest.phone && <p className="tnum text-zinc-600">{formatPhone(b.guest.phone)}</p>}
                {b.guest.nationality && <p className="text-zinc-600">{b.guest.nationality}</p>}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">{t('receipt.stay')}</p>
                <p className="font-medium">
                  {b.room?.label ?? '—'} · {b.room?.typeName ?? ''}
                </p>
                <p className="tnum text-zinc-600">
                  {fmtShort(b.checkIn)} → {fmtShort(b.checkOut)} · {tNights(b.nights)}
                </p>
                <p className="text-zinc-600">
                  {b.adults} {t('booking.adults').toLowerCase()}
                  {b.children ? `, ${b.children} ${t('booking.children').toLowerCase()}` : ''}
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
                {nights.length > 0 && (
                  <tr className="border-b border-zinc-200">
                    <td className="tnum whitespace-nowrap py-2 pr-2 align-top text-zinc-600">{fmtShort(nights[0]!.serviceDate ?? b.checkIn)}</td>
                    <td className="w-full py-2 pr-2">
                      {t('booking.room')} · {nights.length} × {formatPKR(nights[0]!.amountPkr)}
                    </td>
                    <td className="tnum whitespace-nowrap py-2 pl-2 text-right align-top">{formatPKR(nights.reduce((s, i) => s + i.amountPkr, 0))}</td>
                    <td />
                  </tr>
                )}
                {others.map((i) => (
                  <Row key={i.id} item={i} tz={property.timezone} />
                ))}
              </tbody>
              <tfoot className="whitespace-nowrap">
                <tr>
                  <td colSpan={2} className="pt-3 text-right text-zinc-600">
                    {t('receipt.subtotal')}
                  </td>
                  <td className="tnum pt-3 text-right font-medium">{formatPKR(folio?.totalCharges ?? 0)}</td>
                  <td />
                </tr>
                {(folio?.totalTax ?? 0) > 0 && (
                  <tr>
                    <td colSpan={2} className="pt-1 text-right text-zinc-600">
                      {property.taxName ?? t('receipt.tax')} {property.taxRatePct ? `${property.taxRatePct}%` : ''}
                    </td>
                    <td className="tnum pt-1 text-right font-medium">{formatPKR(folio?.totalTax ?? 0)}</td>
                    <td />
                  </tr>
                )}
                <tr>
                  <td colSpan={2} className="pt-1 text-right text-zinc-600">
                    {t('receipt.totalCharges')}
                  </td>
                  <td className="tnum pt-1 text-right font-semibold">{formatPKR((folio?.totalCharges ?? 0) + (folio?.totalTax ?? 0))}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={2} className="pt-1 text-right text-zinc-600">
                    {t('receipt.totalPaid')}
                  </td>
                  <td />
                  <td className="tnum pt-1 text-right font-medium">{formatPKR(folio?.totalPayments ?? 0)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="pt-3 text-right text-base font-semibold">
                    {(folio?.balance ?? 0) > 0 ? t('receipt.balance') : (folio?.balance ?? 0) < 0 ? t('receipt.credit') : t('receipt.balance')}
                    {(folio?.balance ?? 0) === 0 && closed ? ` · ${t('receipt.paid')}` : ''}
                  </td>
                  <td colSpan={2} className="tnum pt-3 text-right text-base font-semibold">
                    {formatPKR(Math.abs(folio?.balance ?? 0))}
                  </td>
                </tr>
              </tfoot>
            </table>

            <footer className="mt-10 grid grid-cols-2 gap-10 text-sm text-zinc-600">
              <div className="border-t border-zinc-400 pt-2">{t('receipt.receivedBy')}</div>
              <div className="border-t border-zinc-400 pt-2">{t('receipt.guestSignature')}</div>
            </footer>
            <p className="mt-8 text-center text-sm text-zinc-500">{settings.receiptFooter ?? t('receipt.thanks')}</p>
            <p className="mt-2 text-center text-[10px] text-zinc-400 print:block">{t('receipt.printed', { when: fmtInstant(printedAt, property.timezone) })}</p>
          </article>
        )}
      </QueryState>
    </div>
  )
}

function Row({ item: i, tz }: { item: FolioItemVM; tz: string }) {
  const money = i.kind === 'payment' || i.kind === 'refund'
  const label = money
    ? `${kindLabel(i.kind)} · ${i.method ? methodLabel(i.method) : ''}${i.reference ? ` · ${i.reference}` : ''}${i.receiptNo ? ` · ${i.receiptNo}` : ''}`
    : i.kind === 'discount'
      ? `${kindLabel('discount')} · ${i.description}`
      : i.description || categoryLabel(i.category)
  const negative = i.kind === 'discount' || i.kind === 'refund'
  const amount = `${negative ? '− ' : ''}${formatPKR(i.amountPkr)}`
  return (
    <tr className="border-b border-zinc-200">
      <td className="tnum whitespace-nowrap py-2 pr-2 align-top text-zinc-600">{fmtInstant(i.postedAt, tz, 'dd MMM')}</td>
      <td className="w-full py-2 pr-2">{label}</td>
      <td className="tnum whitespace-nowrap py-2 pl-2 text-right align-top">{!money ? amount : ''}</td>
      <td className="tnum whitespace-nowrap py-2 pl-2 text-right align-top">{money ? amount : ''}</td>
    </tr>
  )
}
