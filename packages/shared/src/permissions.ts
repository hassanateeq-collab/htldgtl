// Permission matrix — the single mirror of the database's RLS write policies
// and function role checks (supabase/migrations/20261007033000_access_hardening.sql
// and the Release A functions). The UI asks `can(ctx, ability)`; the database
// enforces the same rule, so this only decides what to show.
import type { AccessLevel, TenantRole } from './index'

export type Ability =
  | 'bookings.create'
  | 'bookings.edit'
  | 'bookings.transition' // check in / out, cancel, no-show
  | 'bookings.correct' // undo check-in, reinstate cancelled / no-show
  | 'checkout.override' // check out with a balance due (reason required)
  | 'folio.post' // charges, payments, discounts, refunds
  | 'folio.void'
  | 'folio.reopen'
  | 'guests.edit'
  | 'rooms.status' // housekeeping status
  | 'rooms.manage' // labels, types, active flag
  | 'cash.shift' // open / close shifts
  | 'cash.confirm_own' // confirm a handover you closed yourself
  | 'reports.view'
  | 'audit.view'
  | 'settings.manage'
  | 'staff.manage'
  | 'staff.grant_owner'

const ROLES: Record<Ability, readonly TenantRole[]> = {
  'bookings.create': ['owner', 'manager', 'front_desk'],
  'bookings.edit': ['owner', 'manager', 'front_desk'],
  'bookings.transition': ['owner', 'manager', 'front_desk'],
  'bookings.correct': ['owner', 'manager'],
  'checkout.override': ['owner', 'manager'],
  'folio.post': ['owner', 'manager', 'front_desk', 'accounts'],
  'folio.void': ['owner', 'manager', 'accounts'],
  'folio.reopen': ['owner', 'manager'],
  'guests.edit': ['owner', 'manager', 'front_desk'],
  'rooms.status': ['owner', 'manager', 'front_desk', 'housekeeping'],
  'rooms.manage': ['owner', 'manager'],
  'cash.shift': ['owner', 'manager', 'front_desk', 'accounts'],
  'cash.confirm_own': ['owner', 'manager'],
  'reports.view': ['owner', 'manager', 'accounts'],
  'audit.view': ['owner', 'manager', 'accounts'],
  'settings.manage': ['owner', 'manager'],
  'staff.manage': ['owner', 'manager'],
  'staff.grant_owner': ['owner'],
}

/** Read-type abilities stay available while the subscription is read-only. */
const READ_ABILITIES: ReadonlySet<Ability> = new Set(['reports.view', 'audit.view'])

export interface PermissionContext {
  role: TenantRole | null
  accessLevel: AccessLevel | null
}

export function can(ctx: PermissionContext, ability: Ability): boolean {
  if (!ctx.role || !ctx.accessLevel || ctx.accessLevel === 'none') return false
  if (ctx.accessLevel === 'read_only' && !READ_ABILITIES.has(ability)) return false
  return ROLES[ability].includes(ctx.role)
}

export const ABILITIES = Object.keys(ROLES) as Ability[]
export const ABILITY_ROLES: Readonly<Record<Ability, readonly TenantRole[]>> = ROLES

/** Where a role lands after sign-in. */
export function homeRouteFor(role: TenantRole | null): string {
  if (role === 'housekeeping') return '/housekeeping'
  if (role === 'accounts') return '/bookings?filter=due'
  return '/today'
}
