import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BedDouble, CalendarDays, ClipboardList, Menu, Plus, Sun, type LucideIcon } from 'lucide-react'
import { t, type MessageKey } from '@hotel-digital/shared'
import { cn } from '@/lib/utils'
import { useTenant } from '@/data/tenant'

const tabs: { to: string; label: MessageKey; icon: LucideIcon }[] = [
  { to: '/today', label: 'nav.today', icon: Sun },
  { to: '/calendar', label: 'nav.calendar', icon: CalendarDays },
  { to: '/bookings', label: 'nav.bookings', icon: ClipboardList },
  { to: '/rooms', label: 'nav.rooms', icon: BedDouble },
  { to: '/more', label: 'nav.more', icon: Menu },
]

const WRITER_ROLES = ['owner', 'manager', 'front_desk']
const FAB_ROUTES = ['/today', '/bookings', '/calendar']

export function AppShell() {
  const { tenant, property, access, role } = useTenant()
  const location = useLocation()
  const suspended = access?.accessLevel === 'none'
  const canWrite = access?.accessLevel === 'full' && !!role && WRITER_ROLES.includes(role)
  const showFab = canWrite && FAB_ROUTES.includes(location.pathname)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="px-4 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tenant.name}</p>
          <h1 className="text-base font-semibold leading-tight">{property.name}</h1>
        </div>
        {access?.accessLevel === 'read_only' && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
            {t('shell.readOnly')}
          </div>
        )}
      </header>

      <main>
        {suspended ? (
          <div className="mx-auto max-w-md px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">{t('shell.suspended')}</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {showFab && (
        <Link
          to="/bookings/new"
          aria-label={t('actions.newBooking')}
          className="fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
        >
          <Plus className="h-6 w-6" aria-hidden />
        </Link>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
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
