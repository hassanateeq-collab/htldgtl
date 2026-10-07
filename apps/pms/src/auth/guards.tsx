import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homeRouteFor, type Ability } from '@hotel-digital/shared'
import { Loading } from '@/components/patterns/state'
import { TenantProvider, useTenant } from '@/data/tenant'
import { useSession } from './session'
import { getLastSlug } from './storage'

/** Requires a signed-in session; otherwise sends the user to the right login page. */
export function RequireAuth() {
  const { loading, session } = useSession()
  if (loading) return <Loading />
  if (!session) {
    const slug = getLastSlug()
    return <Navigate to={slug ? `/t/${slug}/login` : '/login'} replace />
  }
  return <Outlet />
}

/** Requires an active tenant in the JWT; loads the tenant context for the app. */
export function RequireTenant() {
  const { activeTenantId } = useSession()
  if (!activeTenantId) return <Navigate to="/select-tenant" replace />
  return (
    <TenantProvider tenantId={activeTenantId}>
      <Outlet />
    </TenantProvider>
  )
}

/** Routes a role must not even open (forms it cannot submit) bounce to its home. */
export function RequireAbility({ ability }: { ability: Ability }) {
  const { can, role } = useTenant()
  const location = useLocation()
  if (!can(ability)) return <Navigate to={homeRouteFor(role)} replace state={{ from: location.pathname }} />
  return <Outlet />
}
