import { useEffect, useState } from 'react'
import { formatPKR, PAYMENT_METHODS, t, type PaymentMethod } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, DefinitionList, DefinitionRow } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { MoneyInput, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { EmptyState, Skeleton, toast } from '@/components/ui/feedback'
import { Page, PageHeader, SectionTitle } from '@/components/patterns/Page'
import { Money } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useTenant } from '@/data/tenant'
import { useCloseShift, useConfirmShift, useCurrentShift, useOpenShift, useShiftHistory } from '@/data/cash'
import { useStaffNames } from '@/data/settings'
import type { CashShiftVM } from '@/data/types'
import { fmtFull, fmtInstant } from '@/lib/clock'
import { errorMessage } from '@/lib/errors'
import { methodLabel } from '@/lib/labels'

type Amounts = Partial<Record<PaymentMethod, number>>

function AmountsList({ amounts, compareTo }: { amounts: Amounts | null; compareTo?: Amounts | null }) {
  const methods = PAYMENT_METHODS.filter((m) => (amounts?.[m] ?? 0) !== 0 || (compareTo?.[m] ?? 0) !== 0)
  if (methods.length === 0) return <p className="text-sm text-muted-foreground">{t('common.none')}</p>
  return (
    <DefinitionList>
      {methods.map((m) => (
        <DefinitionRow key={m} label={methodLabel(m)} value={<Money amount={amounts?.[m] ?? 0} />} />
      ))}
    </DefinitionList>
  )
}

function Discrepancy({ d }: { d: Amounts | null }) {
  if (!d) return null
  const entries = PAYMENT_METHODS.filter((m) => (d[m] ?? 0) !== 0)
  if (entries.length === 0) return <Badge tone="settled">{t('cash.exact')}</Badge>
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((m) => {
        const v = d[m] ?? 0
        return (
          <Badge key={m} tone={v < 0 ? 'due' : 'warning'}>
            {methodLabel(m)}: {v < 0 ? t('cash.short', { amount: formatPKR(-v) }) : t('cash.over', { amount: formatPKR(v) })}
          </Badge>
        )
      })}
    </div>
  )
}

export default function CashScreen() {
  const { can, property } = useTenant()
  const currentQ = useCurrentShift()
  const historyQ = useShiftHistory()
  const open = useOpenShift()
  const closeShift = useCloseShift()
  const confirm = useConfirmShift()
  const staffName = useStaffNames()
  const [openSheet, setOpenSheet] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const canShift = can('cash.shift')

  const current = currentQ.data ?? null

  return (
    <Page width="lg">
      <PageHeader title={t('cash.title')} />
      <QueryState pending={currentQ.isPending} error={currentQ.error} onRetry={() => void currentQ.refetch()} skeleton={<Skeleton className="h-40" />}>
        {current?.open ? (
          <Card>
            <CardHeader title={t('cash.shiftOpen', { time: fmtInstant(current.open.openedAt, property.timezone, 'HH:mm') })} />
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('cash.openedBy', { name: staffName(current.open.openedBy) ?? t('common.unknownUser') })} · {t('cash.openingFloat')}: {formatPKR(current.open.openingFloat)}
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('cash.expected')}</p>
                <AmountsList amounts={current.expected} />
              </div>
              {canShift && (
                <Button size="lg" className="w-full md:w-auto" onClick={() => setCloseOpen(true)}>
                  {t('cash.closeShift')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <EmptyState
                title={t('cash.noOpenShift')}
                action={
                  canShift ? (
                    <Button size="lg" onClick={() => setOpenSheet(true)}>
                      {t('cash.openShift')}
                    </Button>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        )}

        {current?.awaiting && (
          <Card>
            <CardHeader title={t('cash.awaitingConfirmation')} />
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('cash.shiftDate', { date: fmtFull(current.awaiting.shiftDate) })} · {staffName(current.awaiting.closedBy) ?? t('common.unknownUser')}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('cash.expected')}</p>
                  <AmountsList amounts={current.awaiting.expected} compareTo={current.awaiting.declared} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('cash.declared')}</p>
                  <AmountsList amounts={current.awaiting.declared} compareTo={current.awaiting.expected} />
                </div>
              </div>
              {canShift && (
                <Button size="lg" variant="outline" className="w-full md:w-auto" onClick={() => setConfirmOpen(true)}>
                  {t('cash.confirmHandover')}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </QueryState>

      <section className="space-y-2">
        <SectionTitle>{t('cash.history')}</SectionTitle>
        <QueryState pending={historyQ.isPending} error={historyQ.error} skeleton={<Skeleton className="h-32" />}>
          {(historyQ.data ?? []).filter((s) => s.status === 'confirmed').length === 0 ? (
            <EmptyState title={t('cash.empty')} />
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {historyQ
                  .data!.filter((s) => s.status === 'confirmed')
                  .map((s: CashShiftVM) => (
                    <li key={s.id} className="space-y-1 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-medium">{t('cash.shiftDate', { date: fmtFull(s.shiftDate) })}</p>
                        <span className="tnum text-sm text-muted-foreground">
                          {fmtInstant(s.openedAt, property.timezone, 'HH:mm')} – {s.closedAt ? fmtInstant(s.closedAt, property.timezone, 'HH:mm') : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {staffName(s.closedBy) ?? t('common.unknownUser')} → {staffName(s.confirmedBy) ?? t('common.unknownUser')}
                      </p>
                      <Discrepancy d={s.discrepancy} />
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </QueryState>
      </section>

      <OpenShiftSheet
        open={openSheet}
        onOpenChange={setOpenSheet}
        busy={open.isPending}
        onConfirm={async (float, notes) => {
          try {
            await open.mutateAsync({ openingFloat: float, notes })
            toast.success(t('toast.shiftOpened'))
            setOpenSheet(false)
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
      {current?.open && (
        <AmountsSheet
          key={`close-${current.open.id}`}
          open={closeOpen}
          onOpenChange={setCloseOpen}
          title={t('cash.closeShift')}
          hint={t('cash.declareHint')}
          confirmLabel={t('cash.closeShift')}
          initial={current.expected ?? {}}
          busy={closeShift.isPending}
          onConfirm={async (declared, notes) => {
            try {
              await closeShift.mutateAsync({ shiftId: current.open!.id, declared, notes })
              toast.success(t('toast.shiftClosed'))
              setCloseOpen(false)
            } catch (e) {
              toast.error(errorMessage(e))
            }
          }}
        />
      )}
      {current?.awaiting && (
        <AmountsSheet
          key={`confirm-${current.awaiting.id}`}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('cash.confirmHandover')}
          hint={t('cash.selfConfirm')}
          confirmLabel={t('cash.confirmHandover')}
          initial={current.awaiting.declared}
          busy={confirm.isPending}
          onConfirm={async (counted, notes) => {
            try {
              await confirm.mutateAsync({ shiftId: current.awaiting!.id, confirmed: counted, notes })
              toast.success(t('toast.shiftConfirmed'))
              setConfirmOpen(false)
            } catch (e) {
              toast.error(errorMessage(e))
            }
          }}
        />
      )}
    </Page>
  )
}

function OpenShiftSheet({ open, onOpenChange, busy, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; busy: boolean; onConfirm: (float: number, notes: string | null) => Promise<void> }) {
  const [float, setFloat] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('cash.openShift')}
      busy={busy}
      footer={
        <Button className="w-full" size="lg" loading={busy} onClick={() => void onConfirm(Number(float) || 0, notes.trim() || null)}>
          {t('cash.openShift')}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t('cash.openingFloat')}>
          <MoneyInput value={float} onChange={setFloat} placeholder="0" autoFocus />
        </Field>
        <Field label={t('cash.notes')}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
    </Sheet>
  )
}

interface AmountsSheetProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  hint: string
  confirmLabel: string
  initial: Amounts
  busy: boolean
  onConfirm: (amounts: Amounts, notes: string | null) => Promise<void>
}

function AmountsSheet({ open, onOpenChange, title, hint, confirmLabel, initial, busy, onConfirm }: AmountsSheetProps) {
  const [values, setValues] = useState<Record<PaymentMethod, string>>(() => Object.fromEntries(PAYMENT_METHODS.map((m) => [m, initial[m] ? String(initial[m]) : ''])) as Record<PaymentMethod, string>)
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (open) setValues(Object.fromEntries(PAYMENT_METHODS.map((m) => [m, initial[m] ? String(initial[m]) : ''])) as Record<PaymentMethod, string>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const total = PAYMENT_METHODS.reduce((s, m) => s + (Number(values[m]) || 0), 0)
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={hint}
      busy={busy}
      footer={
        <Button
          className="w-full"
          size="lg"
          loading={busy}
          onClick={() => void onConfirm(Object.fromEntries(PAYMENT_METHODS.map((m) => [m, Number(values[m]) || 0])) as Amounts, notes.trim() || null)}
        >
          {confirmLabel} · {formatPKR(total)}
        </Button>
      }
    >
      <div className="space-y-3">
        {PAYMENT_METHODS.map((m) => (
          <Field key={m} label={methodLabel(m)}>
            <MoneyInput value={values[m]} onChange={(v) => setValues((s) => ({ ...s, [m]: v }))} placeholder="0" />
          </Field>
        ))}
        <Field label={t('cash.notes')}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
    </Sheet>
  )
}
