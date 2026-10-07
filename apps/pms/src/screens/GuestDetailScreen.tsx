import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Pencil, Phone, Plus } from 'lucide-react'
import { formatPhone, formatPKR, isCnic, normalizePhone, t } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, DefinitionList, DefinitionRow } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { EmptyState, Skeleton, SkeletonRows, toast } from '@/components/ui/feedback'
import { Page, PageHeader, SectionTitle } from '@/components/patterns/Page'
import { BookingRow } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { IdFields } from '@/components/booking/fields'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useGuestBookings } from '@/data/bookings'
import { useGuest, useUpdateGuest } from '@/data/guests'
import type { GuestVM, IdType } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { idTypeLabel } from '@/lib/labels'

export default function GuestDetailScreen() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { can } = useTenant()
  const today = useHotelToday()
  const guestQ = useGuest(id)
  const historyQ = useGuestBookings(id)
  const update = useUpdateGuest()
  const [editing, setEditing] = useState(params.get('edit') === '1')
  const g = guestQ.data ?? null
  const canEdit = can('guests.edit')
  const canBook = can('bookings.create')

  return (
    <Page width="lg">
      <PageHeader
        title={g?.name ?? t('guests.title')}
        subtitle={g?.phone ? formatPhone(g.phone) : undefined}
        back={-1}
        fallback="/guests"
        actions={
          g && canEdit && !editing ? (
            <Button variant="ghost" size="icon" aria-label={t('guests.edit')} onClick={() => setEditing(true)}>
              <Pencil className="h-5 w-5" aria-hidden />
            </Button>
          ) : undefined
        }
      />
      <QueryState pending={guestQ.isPending} error={guestQ.error} onRetry={() => void guestQ.refetch()} skeleton={<Skeleton className="h-64" />}>
        {!g ? (
          <EmptyState title={t('guests.notFound')} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {g.inHouse && <Badge tone="inhouse">{t('guests.inHouse')}</Badge>}
              {g.hasId ? <Badge tone="settled">{t('guests.idOnFile')}</Badge> : <Badge tone="warning">{t('guests.noId')}</Badge>}
              {g.due > 0 && <Badge tone="due">{t('guests.totalDue')} · {formatPKR(g.due)}</Badge>}
              <span className="text-sm text-muted-foreground">{g.stays === 0 ? t('guests.noStays') : g.stays === 1 ? t('guests.stay') : t('guests.stays', { n: g.stays })}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
              {editing ? (
                <GuestForm
                  guest={g}
                  busy={update.isPending}
                  onCancel={() => {
                    setEditing(false)
                    if (params.get('edit')) {
                      const p = new URLSearchParams(params)
                      p.delete('edit')
                      setParams(p, { replace: true })
                    }
                  }}
                  onSave={async (input) => {
                    try {
                      await update.mutateAsync(input)
                      toast.success(t('guests.saved'))
                      setEditing(false)
                    } catch (e) {
                      throw new Error(errorMessage(e))
                    }
                  }}
                />
              ) : (
                <Card>
                  <CardHeader
                    title={t('booking.guest')}
                    action={
                      canEdit ? (
                        <Button variant="link" size="sm" onClick={() => setEditing(true)}>
                          {t('guests.edit')}
                        </Button>
                      ) : undefined
                    }
                  />
                  <CardContent>
                    <DefinitionList>
                      <DefinitionRow
                        label={t('guests.phone')}
                        value={
                          g.phone ? (
                            <a href={`tel:${g.phone}`} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                              <Phone className="h-4 w-4" aria-hidden /> {formatPhone(g.phone)}
                            </a>
                          ) : (
                            '—'
                          )
                        }
                      />
                      <DefinitionRow label={t('guests.email')} value={g.email ?? '—'} />
                      <DefinitionRow label={t('guests.nationality')} value={g.nationality ?? '—'} />
                      <DefinitionRow label={t('guests.idType')} value={g.idType ? idTypeLabel(g.idType) : '—'} />
                      <DefinitionRow label={t('guests.idNumber')} value={g.idNumber ?? '—'} />
                      {g.idExpiry && <DefinitionRow label={t('guests.idExpiry')} value={g.idExpiry} />}
                      <DefinitionRow label={t('guests.address')} value={g.address ?? '—'} />
                    </DefinitionList>
                    {g.notes && <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{g.notes}</p>}
                    {canBook && (
                      <Button className="mt-4 w-full md:w-auto" asChild>
                        <Link to={`/bookings/new?guest=${g.id}`}>
                          <Plus className="h-4 w-4" aria-hidden />
                          {t('guests.newBooking')}
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              <section className="space-y-2">
                <SectionTitle count={historyQ.data?.length}>{t('guests.history')}</SectionTitle>
                <QueryState pending={historyQ.isPending} error={historyQ.error} skeleton={<SkeletonRows rows={3} />}>
                  {(historyQ.data ?? []).length === 0 ? (
                    <EmptyState title={t('guests.noStays')} />
                  ) : (
                    historyQ.data!.map((b) => <BookingRow key={b.id} booking={b} today={today} />)
                  )}
                </QueryState>
              </section>
            </div>
          </>
        )}
      </QueryState>
    </Page>
  )
}

interface FormProps {
  guest: GuestVM
  busy: boolean
  onCancel: () => void
  onSave: (input: Parameters<ReturnType<typeof useUpdateGuest>['mutateAsync']>[0]) => Promise<void>
}

function GuestForm({ guest: g, busy, onCancel, onSave }: FormProps) {
  const [name, setName] = useState(g.name)
  const [phone, setPhone] = useState(g.phone ?? '')
  const [email, setEmail] = useState(g.email ?? '')
  const [nationality, setNationality] = useState(g.nationality ?? '')
  const [idType, setIdType] = useState<IdType>(g.idType ?? 'cnic')
  const [idNumber, setIdNumber] = useState(g.idNumber ?? '')
  const [idExpiry, setIdExpiry] = useState(g.idExpiry ?? '')
  const [address, setAddress] = useState(g.address ?? '')
  const [notes, setNotes] = useState(g.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const normalized = normalizePhone(phone)
    if (name.trim().length < 2) errs.name = t('new.nameRequired')
    if (phone.trim() && (!normalized || !/^\+[1-9]\d{6,14}$/.test(normalized))) errs.phone = t('new.phoneInvalid')
    if (idNumber.trim() && idType === 'cnic' && !isCnic(idNumber.trim())) errs.id = t('guests.cnicFormat')
    setErrors(errs)
    if (Object.keys(errs).length) return
    setFormError(null)
    try {
      await onSave({
        id: g.id,
        name: name.trim(),
        phone: phone.trim() ? normalized : null,
        email: email.trim() || null,
        nationality: nationality.trim() || null,
        idType: idNumber.trim() ? idType : null,
        idNumber: idNumber.trim() || null,
        idExpiry: idExpiry || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  return (
    <Card>
      <CardHeader title={t('guests.edit')} />
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('guests.name')} required error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" />
          </Field>
          <Field label={t('guests.phone')} error={errors.phone}>
            <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t('guests.email')}>
            <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t('guests.nationality')}>
            <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </Field>
          <IdFields idType={idType} idNumber={idNumber} onTypeChange={setIdType} onNumberChange={setIdNumber} error={errors.id} />
          <Field label={t('guests.idExpiry')}>
            <Input type="date" value={idExpiry} onChange={(e) => setIdExpiry(e.target.value)} />
          </Field>
          <Field label={t('guests.address')}>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </Field>
          <Field label={t('guests.notes')}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
          {formError && (
            <p role="alert" className="text-sm font-medium text-due">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1" loading={busy}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
