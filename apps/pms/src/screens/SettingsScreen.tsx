import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Building2, ChevronRight, BedDouble, ClipboardList, Plus, Receipt, Trash2, Users } from 'lucide-react'
import { formatPKR, t, TENANT_ROLES, type MessageKey, type TenantRole } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input, MoneyInput, Select, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { EmptyState, Skeleton, toast } from '@/components/ui/feedback'
import { ActionBar, Page, PageHeader } from '@/components/patterns/Page'
import { HkBadge } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useSession } from '@/auth/session'
import { useTenant } from '@/data/tenant'
import { useRoomTypes, useRooms } from '@/data/rooms'
import {
  useMembers,
  useRemoveMember,
  useSaveRoom,
  useSaveRoomType,
  useSetMemberRole,
  useUpdateBranding,
  useUpdateProperty,
  useUpdateSettings,
  type RoomInput,
  type RoomTypeInput,
} from '@/data/settings'
import type { ChargePreset, FolioCategory, RoomTypeVM, RoomVM, TaxApplies, TaxMode } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { categoryLabel, roleLabel } from '@/lib/labels'

export default function SettingsScreen() {
  return (
    <Routes>
      <Route index element={<SettingsIndex />} />
      <Route path="property" element={<PropertySettings />} />
      <Route path="rooms" element={<RoomsSettings />} />
      <Route path="booking" element={<BookingSettings />} />
      <Route path="branding" element={<BrandingSettings />} />
      <Route path="staff" element={<StaffSettings />} />
      <Route path="*" element={<Navigate to="/settings" replace />} />
    </Routes>
  )
}

const SECTIONS: { to: string; title: MessageKey; hint: MessageKey; icon: typeof Building2 }[] = [
  { to: 'property', title: 'settings.property', hint: 'settings.propertyHint', icon: Building2 },
  { to: 'rooms', title: 'settings.rooms', hint: 'settings.roomsHint', icon: BedDouble },
  { to: 'booking', title: 'settings.booking', hint: 'settings.bookingHint', icon: ClipboardList },
  { to: 'branding', title: 'settings.branding', hint: 'settings.brandingHint', icon: Receipt },
  { to: 'staff', title: 'settings.staff', hint: 'settings.staffHint', icon: Users },
]

function SettingsIndex() {
  const { property } = useTenant()
  return (
    <Page width="md">
      <PageHeader title={t('settings.title')} subtitle={property.name} />
      <Card>
        <ul className="divide-y divide-border">
          {SECTIONS.map(({ to, title, hint, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex min-h-touch items-center gap-3 px-4 py-3 hover:bg-accent/60 active:bg-accent">
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium">{t(title)}</span>
                  <span className="block truncate text-sm text-muted-foreground">{t(hint)}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  )
}

// ----------------------------------------------------------------- property ----
function PropertySettings() {
  const { property } = useTenant()
  const update = useUpdateProperty()
  const [f, setF] = useState({
    name: property.name,
    address: property.address ?? '',
    city: property.city ?? '',
    phone: property.phone ?? '',
    email: property.email ?? '',
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    taxMode: property.taxMode as TaxMode,
    taxName: property.taxName ?? '',
    taxRatePct: property.taxRatePct ? String(property.taxRatePct) : '',
    taxAppliesTo: property.taxAppliesTo as TaxApplies,
    requireId: property.requireIdAtCheckIn,
    earlyDeparture: property.earlyDeparturePolicy,
    ntn: property.ntn ?? '',
    strn: property.strn ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (f.taxMode !== 'none' && (!f.taxName.trim() || !(Number(f.taxRatePct) > 0))) return setError(t('error.invalid'))
    try {
      await update.mutateAsync({
        name: f.name.trim(),
        address: f.address.trim() || null,
        city: f.city.trim() || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        checkInTime: f.checkInTime,
        checkOutTime: f.checkOutTime,
        taxMode: f.taxMode,
        taxName: f.taxName.trim() || null,
        taxRatePct: Number(f.taxRatePct) || 0,
        taxAppliesTo: f.taxAppliesTo,
        ntn: f.ntn.trim() || null,
        strn: f.strn.trim() || null,
        requireIdAtCheckIn: f.requireId,
        earlyDeparturePolicy: f.earlyDeparture,
      })
      toast.success(t('settings.saved'))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Page width="md" withActionBar>
      <PageHeader title={t('settings.property')} back="/settings" />
      <form id="property-form" onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader title={t('settings.property')} />
          <CardContent className="space-y-4">
            <Field label={t('property.name')} required>
              <Input value={f.name} onChange={(e) => set('name', e.target.value)} required />
            </Field>
            <Field label={t('property.address')}>
              <Input value={f.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('property.city')}>
                <Input value={f.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field label={t('property.phone')}>
                <Input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
            </div>
            <Field label={t('property.email')}>
              <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('property.checkInTime')}>
                <Input type="time" value={f.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} />
              </Field>
              <Field label={t('property.checkOutTime')}>
                <Input type="time" value={f.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t('property.tax')} />
          <CardContent className="space-y-4">
            <Segmented
              ariaLabel={t('property.taxMode')}
              value={f.taxMode}
              onChange={(v) => set('taxMode', v)}
              wrap
              options={(['none', 'exclusive', 'inclusive'] as TaxMode[]).map((m) => ({ value: m, label: t(`property.taxMode.${m}`) }))}
            />
            {f.taxMode !== 'none' && (
              <>
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
                  <Field label={t('property.taxName')} hint={t('property.taxNameHint')} required>
                    <Input value={f.taxName} onChange={(e) => set('taxName', e.target.value)} />
                  </Field>
                  <Field label={t('property.taxRate')} required>
                    <Input type="number" inputMode="decimal" min={0} max={100} step="0.5" value={f.taxRatePct} onChange={(e) => set('taxRatePct', e.target.value)} className="tnum" />
                  </Field>
                </div>
                <Field label={t('property.taxApplies')}>
                  <Segmented
                    ariaLabel={t('property.taxApplies')}
                    value={f.taxAppliesTo}
                    onChange={(v) => set('taxAppliesTo', v)}
                    wrap
                    options={(['room', 'all'] as TaxApplies[]).map((a) => ({ value: a, label: t(`property.taxApplies.${a}`) }))}
                  />
                </Field>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('property.ntn')}>
                <Input value={f.ntn} onChange={(e) => set('ntn', e.target.value)} className="tnum" />
              </Field>
              <Field label={t('property.strn')}>
                <Input value={f.strn} onChange={(e) => set('strn', e.target.value)} className="tnum" />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t('settings.booking')} />
          <CardContent className="space-y-4">
            <label className="flex min-h-touch cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={f.requireId} onChange={(e) => set('requireId', e.target.checked)} />
              <span className="text-base">{t('property.requireId')}</span>
            </label>
            <Field label={t('property.earlyDeparture')}>
              <Segmented
                ariaLabel={t('property.earlyDeparture')}
                value={f.earlyDeparture}
                onChange={(v) => set('earlyDeparture', v)}
                wrap
                options={(['release', 'charge_full'] as const).map((p) => ({ value: p, label: t(`property.earlyDeparture.${p}`) }))}
              />
            </Field>
          </CardContent>
        </Card>
        {error && (
          <p role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </form>
      <ActionBar>
        <Button type="submit" form="property-form" size="lg" className="flex-1" loading={update.isPending}>
          {t('common.save')}
        </Button>
      </ActionBar>
    </Page>
  )
}

// -------------------------------------------------------------------- rooms ----
function RoomsSettings() {
  const typesQ = useRoomTypes()
  const roomsQ = useRooms()
  const [editType, setEditType] = useState<RoomTypeVM | 'new' | null>(null)
  const [editRoom, setEditRoom] = useState<{ room: RoomVM | null; typeId: string } | null>(null)
  const types = typesQ.data ?? []
  const rooms = roomsQ.data ?? []

  return (
    <Page width="lg">
      <PageHeader
        title={t('settings.rooms')}
        back="/settings"
        actions={
          <Button variant="outline" size="sm" onClick={() => setEditType('new')}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('roomtype.add')}
          </Button>
        }
      />
      <QueryState pending={typesQ.isPending || roomsQ.isPending} error={typesQ.error ?? roomsQ.error} skeleton={<Skeleton className="h-64" />}>
        {types.length === 0 ? (
          <EmptyState title={t('rooms.empty')} action={<Button onClick={() => setEditType('new')}>{t('roomtype.add')}</Button>} />
        ) : (
          <div className="space-y-4">
            {types.map((rt) => {
              const typeRooms = rooms.filter((r) => r.roomTypeId === rt.id)
              return (
                <Card key={rt.id}>
                  <CardHeader
                    title={
                      <span className="normal-case tracking-normal text-foreground">
                        {rt.name} <span className="font-normal text-muted-foreground">· {formatPKR(rt.baseRatePkr)} · {t('roomtype.rooms', { n: typeRooms.length })}</span>
                      </span>
                    }
                    action={
                      <Button variant="ghost" size="sm" onClick={() => setEditType(rt)}>
                        {t('common.edit')}
                      </Button>
                    }
                  />
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {typeRooms.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setEditRoom({ room: r, typeId: rt.id })}
                          className="flex min-h-touch items-center gap-2 rounded-lg border border-border bg-card px-3 hover:bg-accent/60"
                        >
                          <span className="tnum text-base font-semibold">{r.label}</span>
                          <HkBadge status={r.housekeepingStatus} />
                          {!r.isActive && <Badge tone="neutral">{t('room.inactive')}</Badge>}
                        </button>
                      ))}
                      <Button variant="outline" onClick={() => setEditRoom({ room: null, typeId: rt.id })}>
                        <Plus className="h-4 w-4" aria-hidden />
                        {t('room.add')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </QueryState>
      {editType && <RoomTypeSheet type={editType === 'new' ? null : editType} nextOrder={types.length} onClose={() => setEditType(null)} />}
      {editRoom && <RoomSheet room={editRoom.room} typeId={editRoom.typeId} types={types} onClose={() => setEditRoom(null)} />}
    </Page>
  )
}

function RoomTypeSheet({ type, nextOrder, onClose }: { type: RoomTypeVM | null; nextOrder: number; onClose: () => void }) {
  const save = useSaveRoomType()
  const [f, setF] = useState({
    name: type?.name ?? '',
    rate: type ? String(type.baseRatePkr) : '',
    bed: type?.bedConfig ?? '',
    size: type?.sizeSqm ? String(type.sizeSqm) : '',
    baseOcc: String(type?.baseOccupancy ?? 2),
    maxOcc: String(type?.maxOccupancy ?? 2),
  })
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    setError(null)
    if (!f.name.trim()) return setError(t('error.invalid'))
    const input: RoomTypeInput = {
      id: type?.id,
      name: f.name.trim(),
      baseRatePkr: Number(f.rate) || 0,
      bedConfig: f.bed.trim() || null,
      sizeSqm: f.size ? Number(f.size) : null,
      baseOccupancy: Math.max(1, Number(f.baseOcc) || 1),
      maxOccupancy: Math.max(Number(f.baseOcc) || 1, Number(f.maxOcc) || 1),
      sortOrder: type?.sortOrder ?? nextOrder,
    }
    try {
      await save.mutateAsync(input)
      toast.success(t('settings.saved'))
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={type ? type.name : t('roomtype.add')}
      busy={save.isPending}
      footer={
        <Button className="w-full" size="lg" onClick={() => void submit()} loading={save.isPending}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t('roomtype.name')} required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label={t('roomtype.rate')} required>
          <MoneyInput value={f.rate} onChange={(v) => setF({ ...f, rate: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('roomtype.bedConfig')}>
            <Input value={f.bed} onChange={(e) => setF({ ...f, bed: e.target.value })} placeholder="1 double" />
          </Field>
          <Field label={t('roomtype.size')}>
            <Input type="number" inputMode="numeric" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('roomtype.occupancy')}>
            <Input type="number" inputMode="numeric" min={1} value={f.baseOcc} onChange={(e) => setF({ ...f, baseOcc: e.target.value })} />
          </Field>
          <Field label={`${t('roomtype.occupancy')} (max)`}>
            <Input type="number" inputMode="numeric" min={1} value={f.maxOcc} onChange={(e) => setF({ ...f, maxOcc: e.target.value })} />
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}

function RoomSheet({ room, typeId, types, onClose }: { room: RoomVM | null; typeId: string; types: RoomTypeVM[]; onClose: () => void }) {
  const save = useSaveRoom()
  const [f, setF] = useState({ label: room?.label ?? '', floor: room?.floor != null ? String(room.floor) : '', typeId: room?.roomTypeId ?? typeId, active: room?.isActive ?? true })
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    setError(null)
    if (!f.label.trim()) return setError(t('error.invalid'))
    const input: RoomInput = { id: room?.id, label: f.label.trim(), floor: f.floor ? Number(f.floor) : null, roomTypeId: f.typeId, isActive: f.active }
    try {
      await save.mutateAsync(input)
      toast.success(t('settings.saved'))
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={room ? `${t('booking.room')} ${room.label}` : t('room.add')}
      busy={save.isPending}
      footer={
        <Button className="w-full" size="lg" onClick={() => void submit()} loading={save.isPending}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('room.label')} required>
            <Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} autoFocus className="tnum" />
          </Field>
          <Field label={t('room.floor')}>
            <Input type="number" inputMode="numeric" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} />
          </Field>
        </div>
        <Field label={t('roomtype.name')}>
          <Select value={f.typeId} onChange={(e) => setF({ ...f, typeId: e.target.value })}>
            {types.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex min-h-touch cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <span className="text-base">{t('room.active')}</span>
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ booking ----
const PRESET_CATEGORIES: FolioCategory[] = ['food', 'laundry', 'minibar', 'extra', 'fee', 'other']

function BookingSettings() {
  const { settings } = useTenant()
  const update = useUpdateSettings()
  const [prefixes, setPrefixes] = useState({ booking: settings.bookingPrefix, receipt: settings.receiptPrefix, folio: settings.folioPrefix })
  const [presets, setPresets] = useState<ChargePreset[]>(settings.chargePresets)
  const [draft, setDraft] = useState<{ label: string; amount: string; category: FolioCategory }>({ label: '', amount: '', category: 'food' })
  const [error, setError] = useState<string | null>(null)
  const prefixOk = (p: string) => /^[A-Z0-9]{1,6}$/.test(p)

  function addPreset() {
    const amount = Number(draft.amount)
    if (!draft.label.trim() || !(amount > 0)) return
    setPresets((p) => [...p, { label: draft.label.trim(), amount, category: draft.category }])
    setDraft({ label: '', amount: '', category: draft.category })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!prefixOk(prefixes.booking) || !prefixOk(prefixes.receipt) || !prefixOk(prefixes.folio)) return setError(t('bookingSettings.prefixHint'))
    try {
      await update.mutateAsync({ bookingPrefix: prefixes.booking, receiptPrefix: prefixes.receipt, folioPrefix: prefixes.folio, chargePresets: presets, receiptFooter: settings.receiptFooter })
      toast.success(t('settings.saved'))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Page width="md" withActionBar>
      <PageHeader title={t('settings.booking')} back="/settings" />
      <form id="booking-settings" onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader title={t('bookingSettings.prefix')} />
          <CardContent className="grid grid-cols-3 gap-3">
            {(['booking', 'receipt', 'folio'] as const).map((k) => (
              <Field key={k} label={t(k === 'booking' ? 'bookingSettings.prefix' : k === 'receipt' ? 'bookingSettings.receiptPrefix' : 'bookingSettings.folioPrefix')} hint={k === 'booking' ? t('bookingSettings.prefixHint') : undefined}>
                <Input value={prefixes[k]} onChange={(e) => setPrefixes({ ...prefixes, [k]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })} className="tnum uppercase" />
              </Field>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('bookingSettings.presets')} />
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('bookingSettings.presetsHint')}</p>
            {presets.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {presets.map((p, i) => (
                  <li key={`${p.label}-${i}`} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">{categoryLabel(p.category)}</span>
                    </span>
                    <span className="tnum text-base">{formatPKR(p.amount)}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={t('common.cancel')} onClick={() => setPresets((s) => s.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
              <Field label={t('bookingSettings.presetLabel')}>
                <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              </Field>
              <Field label={t('bookingSettings.presetAmount')}>
                <MoneyInput value={draft.amount} onChange={(v) => setDraft({ ...draft, amount: v })} />
              </Field>
            </div>
            <Field label={t('bookingSettings.presetCategory')}>
              <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as FolioCategory })}>
                {PRESET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="button" variant="outline" onClick={addPreset} disabled={!draft.label.trim() || !(Number(draft.amount) > 0)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('bookingSettings.addPreset')}
            </Button>
          </CardContent>
        </Card>
        {error && (
          <p role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </form>
      <ActionBar>
        <Button type="submit" form="booking-settings" size="lg" className="flex-1" loading={update.isPending}>
          {t('common.save')}
        </Button>
      </ActionBar>
    </Page>
  )
}

// ----------------------------------------------------------------- branding ----
function BrandingSettings() {
  const { branding, settings } = useTenant()
  const updateBranding = useUpdateBranding()
  const updateSettings = useUpdateSettings()
  const [legalName, setLegalName] = useState(branding?.legalName ?? '')
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl ?? '')
  const [footer, setFooter] = useState(settings.receiptFooter ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = updateBranding.isPending || updateSettings.isPending

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await updateBranding.mutateAsync({ legalName: legalName.trim() || null, logoUrl: logoUrl.trim() || null })
      await updateSettings.mutateAsync({ ...settings, receiptFooter: footer.trim() || null })
      toast.success(t('settings.saved'))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Page width="md" withActionBar>
      <PageHeader title={t('settings.branding')} back="/settings" />
      <form id="branding-form" onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader title={t('settings.branding')} />
          <CardContent className="space-y-4">
            <Field label={t('branding.legalName')}>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </Field>
            <Field label="Logo URL">
              <Input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://" />
            </Field>
            <Field label={t('branding.receiptFooter')} hint={t('branding.receiptFooterHint')}>
              <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} placeholder={t('receipt.thanks')} />
            </Field>
          </CardContent>
        </Card>
        {error && (
          <p role="alert" className="text-sm font-medium text-due">
            {error}
          </p>
        )}
      </form>
      <ActionBar>
        <Button type="submit" form="branding-form" size="lg" className="flex-1" loading={busy}>
          {t('common.save')}
        </Button>
      </ActionBar>
    </Page>
  )
}

// -------------------------------------------------------------------- staff ----
function StaffSettings() {
  const { can } = useTenant()
  const { session } = useSession()
  const membersQ = useMembers()
  const setRole = useSetMemberRole()
  const remove = useRemoveMember()
  const [removing, setRemoving] = useState<string | null>(null)
  const canGrantOwner = can('staff.grant_owner')

  useEffect(() => {
    if (!removing) return
    const id = window.setTimeout(() => setRemoving(null), 4000)
    return () => window.clearTimeout(id)
  }, [removing])

  async function change(membershipId: string, role: TenantRole) {
    try {
      await setRole.mutateAsync({ membershipId, role })
      toast.success(t('staff.roleChanged'))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  async function doRemove(membershipId: string) {
    if (removing !== membershipId) return setRemoving(membershipId)
    try {
      await remove.mutateAsync({ membershipId })
      setRemoving(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Page width="md">
      <PageHeader title={t('settings.staff')} back="/settings" />
      <p className="text-sm text-muted-foreground">{t('staff.inviteHint')}</p>
      <QueryState pending={membersQ.isPending} error={membersQ.error} skeleton={<Skeleton className="h-40" />}>
        <Card>
          <ul className="divide-y divide-border">
            {(membersQ.data ?? []).map((m) => {
              const isSelf = m.userId === session?.user.id
              const locked = isSelf || (m.role === 'owner' && !canGrantOwner)
              return (
                <li key={m.id} className="px-4 py-3 sm:flex sm:items-center sm:gap-3">
                  <div className="min-w-0 sm:flex-1">
                    <p className="break-all text-base font-medium">
                      {m.email ?? m.userId} {isSelf && <span className="text-xs text-muted-foreground">· {t('staff.you')}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{roleLabel(m.role)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 sm:mt-0">
                    <div className="w-44">
                      <Select value={m.role} disabled={locked || setRole.isPending} onChange={(e) => void change(m.id, e.target.value as TenantRole)} aria-label={t('staff.role')}>
                        {TENANT_ROLES.filter((r) => r !== 'owner' || canGrantOwner || m.role === 'owner').map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {!locked && (
                      <Button variant={removing === m.id ? 'destructive' : 'ghost'} size="sm" onClick={() => void doRemove(m.id)} loading={remove.isPending && removing === m.id}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                        {removing === m.id ? t('common.confirm') : t('staff.remove')}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </QueryState>
    </Page>
  )
}
