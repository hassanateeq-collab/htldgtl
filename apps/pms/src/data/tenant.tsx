import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TenantRole } from '@hotel-digital/shared'
import { supabase } from '@/lib/supabase'
import { ErrorNote, Loading } from '@/components/State'
import type { AccessVM, PropertyVM, TenantVM } from './types'

interface TenantContextValue {
  tenant: TenantVM
  /** v1: the tenant's first property. Multi-property switching comes with addon.multi_property. */
  property: PropertyVM
  access: AccessVM | null
  role: TenantRole | null
}

const Ctx = createContext<TenantContextValue | null>(null)

interface AccessRow {
  tenant_id: string
  status: AccessVM['status']
  access_level: AccessVM['accessLevel']
}

async function loadTenantContext(tenantId: string): Promise<TenantContextValue> {
  const [tenantRes, propertyRes, accessRes, roleRes] = await Promise.all([
    supabase.from('tenants').select('id, slug, name').eq('id', tenantId).single(),
    supabase
      .from('properties')
      .select('id, name, city, address, timezone, currency')
      .eq('tenant_id', tenantId)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
    supabase.rpc('my_tenant_access'),
    supabase.rpc('current_role_in_tenant'),
  ])
  if (tenantRes.error) throw tenantRes.error
  if (propertyRes.error) throw propertyRes.error
  if (accessRes.error) throw accessRes.error
  if (roleRes.error) throw roleRes.error
  if (!propertyRes.data) throw new Error('No property is set up for this hotel yet.')

  const accessRows = (accessRes.data ?? []) as AccessRow[]
  const accessRow = accessRows[0]

  return {
    tenant: tenantRes.data as TenantVM,
    property: propertyRes.data as PropertyVM,
    access: accessRow ? { status: accessRow.status, accessLevel: accessRow.access_level } : null,
    role: (roleRes.data as TenantRole | null) ?? null,
  }
}

export function TenantProvider({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const query = useQuery({
    queryKey: ['tenant-context', tenantId],
    queryFn: () => loadTenantContext(tenantId),
    staleTime: 60_000,
  })
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorNote message={query.error.message} onRetry={() => void query.refetch()} />
  return <Ctx.Provider value={query.data}>{children}</Ctx.Provider>
}

export function useTenant(): TenantContextValue {
  const value = useContext(Ctx)
  if (!value) throw new Error('useTenant must be used inside TenantProvider')
  return value
}
