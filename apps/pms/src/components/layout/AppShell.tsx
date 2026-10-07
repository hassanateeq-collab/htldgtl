import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BedDouble, CalendarDays, ClipboardList, Menu, Plus, Sun, Users, type LucideIcon } from 'lucide-react'
import { t, type MessageKey } from '@hotel-digital/shared'
import { cn } from '@/lib/utils'
import { useTenant } from '@/data/tenant'

interface NavItem {
  to: string
  label: MessageKey
  icon: LucideIcon
}

/** Mobile bottom tabs — five slots; Guests lives under More. */
const tabs: NavItem[] = [
  { to: '/today', label: 'nav.today', icon: Sun },
  { to: '/calendar', label: 'nav.calendar', icon: CalendarDays },
  { to: '/bookings', label: 'nav.bookings', icon: ClipboardList },
  { to: '/rooms', label: 'nav.rooms', icon: BedDouble },
  { to: '/more', label: 'nav.more', icon: Menu },
]

/** Desktop sidebar — room for Guests as a first-class entry. */
const sidebar: NavItem[] = [
  { to: '/today', label: 'nav.today', icon: Sun },
  { to: '/calendar', label: 'nav.calendar', icon: CalendarDays },
  { to: '/bookings', label: 'nav.bookings', icon: ClipboardList },
  { to: '/guests', label: 'nav.guests', icon: Users },
  { to: '/rooms', label: 'nav.rooms', icon: BedDouble },
  { to: '/more', label: 'nav.more', icon: Menu },
]

const WRITER_ROLES = ['owner', 'manager', 'front_desk']
const FAB_ROUTES = ['/today', '/bookings', '/calendar']

/**
 * Mobile (< md): top bar, bottom tab bar, floating "+".
 * Desktop (>= md): fixed left sidebar with names, nav and a New booking button;
 * no top bar or bottom tabs, so content gets the full height and width.
 */
export function AppShell() {
  const { tenant, property, access, role } = useTenant()
  const location = useLocation()
  const suspended = access?.accessLevel === 'none'
  const canWrite = access?.accessLevel === 'full' && !!role && WRITER_ROLES.includes(role)
  const showFab = canWrite && FAB_ROUTES.includes(location.pathname)

  return (
    <div className="min-h-svh bg-background text-foreground md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-svh md:w-56 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-background">
        <div className="px-4 py-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tenant.name}</p>
          <p className="text-base font-semibold leading-tight">{property.name}</p>
        </div>
        <nav className="flex-1 px-2">
          <ul className="space-y-1">
            {sidebar.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                      isActive ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60',
                    )
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {canWrite && (
          <div className="p-3">
            <Link
              to="/bookings/new"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('actions.newBooking')}
            </Link>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur md:hidden">
          <div className="px-4 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tenant.name}</p>
            <h1 className="text-base font-semibold leading-tight">{property.name}</h1>
          </div>
        </header>

        {access?.accessLevel === 'read_only' && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
            {t('shell.readOnly')}
          </div>
        )}

        <main className="flex-1">
          {suspended ? (
            <div className="mx-auto max-w-md px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">{t('shell.suspended')}</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Mobile floating "+" */}
      {showFab && (
        <Link
          to="/bookings/new"
          aria-label={t('actions.newBooking')}
          className="fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 md:hidden"
          style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
        >
          <Plus className="h-6 w-6" aria-hidden />
        </Link>
      )}

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 py-2 text-[11px]',
                    isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t(label)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
