import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { can as canDo, type Ability, type TenantRole } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { hotelToday, type DateStr } from '@/lib/clock'
import { errorMessage } from '@/lib/errors'
import { ErrorNote, Loading } from '@/components/patterns/state'
import type { Scope } from './keys'
import type { AccessVM, BrandingVM, ChargePreset, FolioCategory, PropertyVM, TenantSettingsVM, TenantVM } from './types'

interface TenantContextValue {
  tenant: TenantVM
  /** v1: the tenant's first property. Multi-property switching comes with addon.multi_property. */
  property: PropertyVM
  branding: BrandingVM | null
  settings: TenantSettingsVM
  access: AccessVM | null
  role: TenantRole | null
  scope: Scope
  can: (ability: Ability) => boolean
  refresh: () => void
}

const Ctx = createContext<TenantContextValue | null>(null)

const CATEGORIES: FolioCategory[] = ['room', 'food', 'laundry', 'minibar', 'extra', 'fee', 'adjustment', 'deposit', 'settlement', 'other']

function parseSettings(raw: unknown): TenantSettingsVM {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const presets: ChargePreset[] = Array.isArray(s.charge_presets)
    ? (s.charge_presets as unknown[])
        .map((p) => {
          const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
          const amount = Number(o.amount)
          const category = CATEGORIES.includes(o.category as FolioCategory) ? (o.category as FolioCategory) : 'other'
          return typeof o.label === 'string' && o.label.trim() && Number.isFinite(amount) && amount > 0
            ? { label: o.label.trim(), amount, category }
            : null
        })
        .filter((p): p is ChargePreset => p !== null)
    : []
  return {
    bookingPrefix: typeof s.booking_prefix === 'string' ? s.booking_prefix : 'BK',
    receiptPrefix: typeof s.receipt_prefix === 'string' ? s.receipt_prefix : 'RCT',
    folioPrefix: typeof s.folio_prefix === 'string' ? s.folio_prefix : 'F',
    chargePresets: presets,
    receiptFooter: typeof s.receipt_footer === 'string' ? s.receipt_footer : null,
  }
}

async function loadTenantContext(tenantId: string) {
  const [tenantRes, propertyRes, brandingRes, settingsRes, accessRes, roleRes] = await Promise.all([
    supabase.from('tenants').select('id, slug, name').eq('id', tenantId).single(),
    supabase
      .from('properties')
      .select(
        'id, name, city, address, phone, email, timezone, currency, check_in_time, check_out_time, tax_name, tax_rate_pct, tax_mode, tax_applies_to, ntn, strn, require_id_at_check_in, early_departure_policy',
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
    supabase.from('tenant_branding').select('legal_name, logo_url, primary_color').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('tenant_settings').select('settings').eq('tenant_id', tenantId).maybeSingle(),
    supabase.rpc('my_tenant_access'),
    supabase.rpc('current_role_in_tenant'),
  ])
  for (const res of [tenantRes, propertyRes, brandingRes, settingsRes, accessRes, roleRes]) {
    if (res.error) throw res.error
  }
  const p = propertyRes.data
  if (!p) throw new Error('no_property')

  const accessRow = accessRes.data?.[0]
  const property: PropertyVM = {
    id: p.id,
    name: p.name,
    city: p.city,
    address: p.address,
    phone: p.phone,
    email: p.email,
    timezone: p.timezone,
    currency: p.currency,
    checkInTime: p.check_in_time.slice(0, 5),
    checkOutTime: p.check_out_time.slice(0, 5),
    taxName: p.tax_name,
    taxRatePct: Number(p.tax_rate_pct),
    taxMode: p.tax_mode as PropertyVM['taxMode'],
    taxAppliesTo: p.tax_applies_to as PropertyVM['taxAppliesTo'],
    ntn: p.ntn,
    strn: p.strn,
    requireIdAtCheckIn: p.require_id_at_check_in,
    earlyDeparturePolicy: p.early_departure_policy as PropertyVM['earlyDeparturePolicy'],
  }
  return {
    tenant: tenantRes.data as TenantVM,
    property,
    branding: brandingRes.data
      ? { legalName: brandingRes.data.legal_name, logoUrl: brandingRes.data.logo_url, primaryColor: brandingRes.data.primary_color }
      : null,
    settings: parseSettings(settingsRes.data?.settings),
    access: accessRow ? { status: accessRow.status, accessLevel: accessRow.access_level as AccessVM['accessLevel'] } : null,
    role: (roleRes.data as TenantRole | null) ?? null,
  }
}

export function TenantProvider({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['tenant-context', tenantId],
    queryFn: () => loadTenantContext(tenantId),
    staleTime: 5 * 60_000,
  })

  const value = useMemo<TenantContextValue | null>(() => {
    if (!query.data) return null
    const { tenant, property, branding, settings, access, role } = query.data
    const ctx = { role, accessLevel: access?.accessLevel ?? null }
    return {
      tenant,
      property,
      branding,
      settings,
      access,
      role,
      scope: { tenantId: tenant.id, propertyId: property.id },
      can: (ability) => canDo(ctx, ability),
      refresh: () => void queryClient.invalidateQueries({ queryKey: ['tenant-context', tenantId] }),
    }
  }, [query.data, queryClient, tenantId])

  if (query.isPending) return <Loading />
  if (query.isError || !value) {
    return <ErrorNote message={query.error ? errorMessage(query.error) : undefined} onRetry={() => void query.refetch()} />
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTenant(): TenantContextValue {
  const value = useContext(Ctx)
  if (!value) throw new Error('useTenant must be used inside TenantProvider')
  return value
}

/** Today in the hotel's timezone; re-evaluated every half minute so midnight rolls over live. */
export function useHotelToday(): DateStr {
  const { property } = useTenant()
  const [today, setToday] = useState(() => hotelToday(property.timezone))
  useEffect(() => {
    const tick = () => setToday(hotelToday(property.timezone))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [property.timezone])
  return today
}
