import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { formatPKR, t, toPakistanE164 } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { BookingRow } from '@/components/BookingRow'
import { Panel } from '@/components/Panel'
import { ErrorNote, Loading } from '@/components/State'
import { useTenant } from '@/data/tenant'
import { useBookings, useGuests } from '@/data/queries'
import { actionErrorLabel, useUpdateGuest } from '@/data/mutations'
import { owesMoney, type GuestRecordVM } from '@/data/types'

const inputClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const EDITOR_ROLES = ['owner', 'manager', 'front_desk']

export function GuestDetailScreen() {
  const { id } = useParams()
  const { property, role, access } = useTenant()
  const guestsQ = useGuests()
  const bookingsQ = useBookings(property.id)
  const update = useUpdateGuest(property.id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<GuestRecordVM | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (guestsQ.isPending || bookingsQ.isPending) return <Loading />
  const loadError = guestsQ.error ?? bookingsQ.error
  if (loadError) return <ErrorNote message={loadError.message} />

  const guest = (guestsQ.data ?? []).find((g) => g.id === id)
  if (!guest) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">{t('guests.notFound')}</p>
      </div>
    )
  }

  const history = (bookingsQ.data ?? [])
    .filter((b) => b.guest?.id === guest.id)
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
  const totalDue = history.filter(owesMoney).reduce((sum, b) => sum + (b.balance ?? 0), 0)
  const canEdit = access?.accessLevel === 'full' && !!role && EDITOR_ROLES.includes(role)
  const form = draft ?? guest

  function startEdit() {
    setDraft({ ...guest! })
    setError(null)
    setEditing(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    setError(null)
    const phone = draft.phone?.trim() ?? ''
    try {
      await update.mutateAsync({
        id: draft.id,
        name: draft.name.trim(),
        phone: phone ? (toPakistanE164(phone) ?? phone) : null,
        email: draft.email?.trim() || null,
        nationality: draft.nationality?.trim() || null,
        cnic: draft.cnic?.trim() || null,
        passport: draft.passport?.trim() || null,
      })
      setEditing(false)
      setDraft(null)
    } catch (err) {
      setError(actionErrorLabel(err))
    }
  }

  const field = (key: keyof GuestRecordVM, label: string, type = 'text') => (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        className={inputClass}
        type={type}
        value={(form[key] as string | null) ?? ''}
        onChange={(e) => setDraft({ ...(draft ?? guest), [key]: e.target.value })}
      />
    </label>
  )

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-24 md:max-w-5xl md:px-6 md:py-6 md:pb-8">
      <BackLink />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold md:text-2xl">{guest.name}</h2>
          {guest.phone && <p className="text-sm text-muted-foreground">{guest.phone}</p>}
        </div>
        {totalDue > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('guests.totalDue')}</p>
            <p className="text-lg font-semibold text-red-700">{formatPKR(totalDue)}</p>
          </div>
        )}
      </div>

      <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <Panel title={t('booking.guest')}>
          {editing ? (
            <form onSubmit={save} className="space-y-3">
              {field('name', t('guests.name'))}
              {field('phone', t('guests.phone'), 'tel')}
              {field('email', t('guests.email'), 'email')}
              {field('nationality', t('guests.nationality'))}
              {field('cnic', t('guests.cnic'))}
              {field('passport', t('guests.passport'))}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={update.isPending || !form.name.trim()}>
                  {update.isPending ? t('actions.working') : t('guests.save')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false)
                    setDraft(null)
                  }}
                >
                  {t('guests.cancel')}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <Row label={t('guests.phone')} value={guest.phone ?? '—'} />
              <Row label={t('guests.email')} value={guest.email ?? '—'} />
              <Row label={t('guests.nationality')} value={guest.nationality ?? '—'} />
              <Row label={t('guests.cnic')} value={guest.cnic ?? '—'} />
              <Row label={t('guests.passport')} value={guest.passport ?? '—'} />
              {canEdit && (
                <Button size="sm" variant="outline" className="mt-3" onClick={startEdit}>
                  {t('guests.edit')}
                </Button>
              )}
            </>
          )}
        </Panel>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t('guests.history')} <span className="font-normal text-muted-foreground">({history.length})</span>
          </h3>
          {history.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
              {t('bookings.empty')}
            </p>
          ) : (
            history.map((b) => <BookingRow key={b.id} booking={b} />)
          )}
        </section>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/guests" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {t('common.back')}
    </Link>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
