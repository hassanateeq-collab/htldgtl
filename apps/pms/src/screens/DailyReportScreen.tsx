import { useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Share2 } from 'lucide-react'
import { formatPKR, PAYMENT_METHODS, t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, DefinitionList, DefinitionRow } from '@/components/ui/card'
import { Skeleton, toast } from '@/components/ui/feedback'
import { Page, PageHeader } from '@/components/patterns/Page'
import { KpiTile, Money } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useDailyReport, type DailyReportVM } from '@/data/reports'
import { addDaysStr, fmtLong, isDateStr } from '@/lib/clock'
import { methodLabel } from '@/lib/labels'

function summaryText(r: DailyReportVM, propertyName: string): string {
  const occ = r.rooms.total - r.rooms.outOfOrder > 0 ? Math.round((r.rooms.occupied / (r.rooms.total - r.rooms.outOfOrder)) * 100) : 0
  const lines = [
    `${propertyName} — ${t('report.title')} ${fmtLong(r.date)}`,
    `${t('report.arrivals')}: ${r.arrivals.arrived}/${r.arrivals.expected}${r.arrivals.noShow ? ` (${r.arrivals.noShow} ${t('report.noShows').toLowerCase()})` : ''}`,
    `${t('report.departures')}: ${r.departures.left}/${r.departures.expected}`,
    `${t('report.inHouse')}: ${r.inHouse} · ${t('report.occupancy')}: ${occ}% (${r.rooms.occupied}/${r.rooms.total - r.rooms.outOfOrder})`,
    `${t('report.revenue')}: ${formatPKR(r.revenue.room + r.revenue.other)} (${t('report.roomRevenue')} ${formatPKR(r.revenue.room)}, ${t('report.otherRevenue')} ${formatPKR(r.revenue.other)}${r.revenue.tax ? `, ${t('report.tax')} ${formatPKR(r.revenue.tax)}` : ''})`,
    `${t('report.collected')}: ${formatPKR(r.paymentsTotal)}` +
      (Object.keys(r.payments).length ? ` — ${PAYMENT_METHODS.filter((m) => r.payments[m]).map((m) => `${methodLabel(m)} ${formatPKR(r.payments[m]!)}`).join(', ')}` : ''),
    `${t('report.outstanding')}: ${formatPKR(r.outstanding)} (${t('report.outstandingCount', { n: r.outstandingCount })})`,
  ]
  return lines.join('\n')
}

export default function DailyReportScreen() {
  const { property } = useTenant()
  const today = useHotelToday()
  const [date, setDate] = useState(today)
  const reportQ = useDailyReport(date)
  const r = reportQ.data

  async function share() {
    if (!r) return
    const text = summaryText(r, property.name)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast.success(t('common.copied'))
      }
    } catch {
      /* user cancelled */
    }
  }

  const sellable = r ? r.rooms.total - r.rooms.outOfOrder : 0
  const occ = r && sellable > 0 ? Math.round((r.rooms.occupied / sellable) * 100) : 0

  return (
    <Page width="lg">
      <PageHeader
        title={t('report.title')}
        subtitle={fmtLong(date)}
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label={t('report.share')} onClick={() => void share()} disabled={!r}>
              <Share2 className="h-5 w-5" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t('report.print')} onClick={() => window.print()} disabled={!r} className="hidden md:inline-flex">
              <Printer className="h-5 w-5" aria-hidden />
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="outline" size="icon" aria-label={t('cal.prev')} onClick={() => setDate(addDaysStr(date, -1))}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <input type="date" aria-label={t('report.date')} className="h-touch flex-1 rounded-md border border-input bg-card px-3 text-base md:flex-none" value={date} max={today} onChange={(e) => isDateStr(e.target.value) && setDate(e.target.value)} />
        <Button variant="outline" size="icon" aria-label={t('cal.next')} onClick={() => setDate(addDaysStr(date, 1))} disabled={date >= today}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => setDate(today)} disabled={date === today}>
          {t('common.today')}
        </Button>
      </div>

      <QueryState pending={reportQ.isPending} error={reportQ.error} onRetry={() => void reportQ.refetch()} skeleton={<Skeleton className="h-64" />}>
        {r && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              <KpiTile label={t('report.arrivals')} value={<>{r.arrivals.arrived}<span className="text-base font-normal text-muted-foreground"> / {r.arrivals.expected}</span></>} sub={r.arrivals.pending ? t('report.pending', { n: r.arrivals.pending }) : r.arrivals.noShow ? `${r.arrivals.noShow} ${t('report.noShows').toLowerCase()}` : undefined} />
              <KpiTile label={t('report.departures')} value={<>{r.departures.left}<span className="text-base font-normal text-muted-foreground"> / {r.departures.expected}</span></>} sub={r.departures.pending ? t('report.pending', { n: r.departures.pending }) : undefined} />
              <KpiTile label={t('report.inHouse')} value={r.inHouse} />
              <KpiTile label={t('report.occupancy')} value={`${occ}%`} sub={`${t('report.roomsSold', { sold: r.rooms.occupied, total: sellable })}${r.rooms.outOfOrder ? ` · ${t('report.outOfOrder', { n: r.rooms.outOfOrder })}` : ''}`} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader title={t('report.revenue')} />
                <CardContent>
                  <DefinitionList>
                    <DefinitionRow label={t('report.roomRevenue')} value={<Money amount={r.revenue.room} />} />
                    <DefinitionRow label={t('report.otherRevenue')} value={<Money amount={r.revenue.other} />} />
                    {r.revenue.discounts > 0 && <DefinitionRow label={t('report.discounts')} value={<Money amount={-r.revenue.discounts} />} />}
                    {r.revenue.tax > 0 && <DefinitionRow label={t('report.tax')} value={<Money amount={r.revenue.tax} />} />}
                    <DefinitionRow label={t('folio.total')} value={<Money amount={r.revenue.room + r.revenue.other + r.revenue.tax} />} emphasis />
                  </DefinitionList>
                </CardContent>
              </Card>
              <Card>
                <CardHeader title={t('report.collected')} />
                <CardContent>
                  <DefinitionList>
                    {PAYMENT_METHODS.filter((m) => (r.payments[m] ?? 0) !== 0).map((m) => (
                      <DefinitionRow key={m} label={methodLabel(m)} value={<Money amount={r.payments[m] ?? 0} />} />
                    ))}
                    <DefinitionRow label={t('folio.total')} value={<Money amount={r.paymentsTotal} />} emphasis />
                  </DefinitionList>
                  <DefinitionList className="mt-3 border-t border-border pt-2">
                    <DefinitionRow label={t('report.outstanding')} value={<span className={r.outstanding > 0 ? 'text-due' : undefined}><Money amount={r.outstanding} /></span>} />
                    <DefinitionRow label={t('report.outstandingCount', { n: r.outstandingCount })} value="" />
                  </DefinitionList>
                </CardContent>
              </Card>
              <Card>
                <CardHeader title={t('bookings.title')} />
                <CardContent>
                  <DefinitionList>
                    <DefinitionRow label={t('report.newBookings')} value={r.newBookings} />
                    <DefinitionRow label={t('report.cancellations')} value={r.cancellations} />
                    <DefinitionRow label={t('report.noShows')} value={r.arrivals.noShow} />
                  </DefinitionList>
                </CardContent>
              </Card>
              <Card>
                <CardHeader title={t('report.shifts')} />
                <CardContent>
                  {r.shifts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('report.noShifts')}</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {r.shifts.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3">
                          <span>{t(`cash.${s.status === 'open' ? 'opened' : s.status === 'handed_over' ? 'closed' : 'confirmed'}`)}</span>
                          <span className="tnum text-muted-foreground">
                            {s.discrepancy
                              ? PAYMENT_METHODS.filter((m) => s.discrepancy![m]).map((m) => `${methodLabel(m)} ${s.discrepancy![m]! < 0 ? '−' : '+'}${formatPKR(Math.abs(s.discrepancy![m]!))}`).join(', ') || t('cash.exact')
                              : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </Page>
  )
}
