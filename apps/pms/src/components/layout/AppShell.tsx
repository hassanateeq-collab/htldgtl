import { Fragment, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BedDouble,
  CalendarDays,
  ClipboardList,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { t, type MessageKey } from '@hotel-digital/shared'
import { cn } from '@/lib/utils'
import { useTenant } from '@/data/tenant'
import { useSession } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { BackButton, HeaderProvider, useHeader } from '@/components/patterns/Page'
import { OfflineBanner, ScreenErrorBoundary } from '@/components/patterns/state'
import { roleLabel } from '@/lib/labels'

interface NavItem {
  to: string
  label: MessageKey
  icon: LucideIcon
}

const TABS_DEFAULT: NavItem[] = [
  { to: '/today', label: 'nav.today', icon: Sun },
  { to: '/rooms', label: 'nav.rooms', icon: BedDouble },
  { to: '/bookings', label: 'nav.bookings', icon: ClipboardList },
  { to: '/calendar', label: 'nav.calendar', icon: CalendarDays },
  { to: '/more', label: 'nav.more', icon: MenuIcon },
]

const TABS_HOUSEKEEPING: NavItem[] = [
  { to: '/housekeeping', label: 'nav.housekeeping', icon: Sparkles },
  { to: '/rooms', label: 'nav.rooms', icon: BedDouble },
  { to: '/today', label: 'nav.today', icon: Sun },
  { to: '/more', label: 'nav.more', icon: MenuIcon },
]

const SIDEBAR: { item: NavItem; ability?: 'reports.view' | 'settings.manage' }[] = [
  { item: { to: '/today', label: 'nav.today', icon: Sun } },
  { item: { to: '/rooms', label: 'nav.rooms', icon: BedDouble } },
  { item: { to: '/calendar', label: 'nav.calendar', icon: CalendarDays } },
  { item: { to: '/bookings', label: 'nav.bookings', icon: ClipboardList } },
  { item: { to: '/guests', label: 'nav.guests', icon: Users } },
  { item: { to: '/housekeeping', label: 'nav.housekeeping', icon: Sparkles } },
  { item: { to: '/cash', label: 'nav.cash', icon: Wallet } },
  { item: { to: '/reports/daily', label: 'nav.reports', icon: BarChart3 }, ability: 'reports.view' },
  { item: { to: '/settings', label: 'nav.settings', icon: Settings }, ability: 'settings.manage' },
]

/** Index in the tab list before which the "New" button is inserted (centre of five). */
const CREATE_SLOT = 2

export function AppShell() {
  return (
    <HeaderProvider>
      <ShellFrame />
    </HeaderProvider>
  )
}

function ShellFrame() {
  const { tenant, property, access, role, can } = useTenant()
  const { session, signOut } = useSession()
  const navigate = useNavigate()
  const { header } = useHeader()
  const [createOpen, setCreateOpen] = useState(false)

  const suspended = access?.accessLevel === 'none'
  const canCreate = can('bookings.create')
  const tabs = role === 'housekeeping' ? TABS_HOUSEKEEPING : TABS_DEFAULT

  async function onSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-svh bg-background text-foreground md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-svh md:w-60 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-card">
        <div className="px-4 pb-3 pt-4">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{tenant.name}</p>
          <p className="truncate text-base font-semibold leading-tight">{property.name}</p>
        </div>
        {canCreate && (
          <div className="flex flex-col gap-2 px-3 pb-3">
            <Button className="w-full justify-start" size="sm" asChild>
              <Link to="/bookings/new?walkin=1">
                <UserPlus className="h-4 w-4" aria-hidden />
                {t('shell.walkIn')}
              </Link>
            </Button>
            <Button className="w-full justify-start" size="sm" variant="outline" asChild>
              <Link to="/bookings/new">
                <Plus className="h-4 w-4" aria-hidden />
                {t('shell.newBooking')}
              </Link>
            </Button>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-2" aria-label={t('shell.mainNav')}>
          <ul className="space-y-0.5">
            {SIDEBAR.filter(({ ability }) => !ability || can(ability)).map(({ item: { to, label, icon: Icon } }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-3 rounded-md px-3 text-sm',
                      isActive ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
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
        <div className="border-t border-border px-4 py-3 text-sm">
          <p className="truncate font-medium">{session?.user.email}</p>
          <p className="text-xs text-muted-foreground">{role ? roleLabel(role) : ''}</p>
          <div className="mt-2 flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/select-tenant')}>
              {t('auth.switchHotel')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void onSignOut()}>
              <LogOut className="h-4 w-4" aria-hidden />
              {t('auth.signOut')}
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: the current page's title, back and actions */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur md:hidden">
          <div className="flex h-[var(--topbar-h)] items-center gap-1 px-2">
            {header?.back !== undefined ? <BackButton to={header.back} fallback={header.fallback} /> : <div className="w-2" />}
            <div className="min-w-0 flex-1 px-1">
              <h1 className="truncate text-base font-semibold leading-tight">{header?.title ?? property.name}</h1>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">{header?.subtitle ?? property.name}</p>
            </div>
            {header?.actions && <div className="flex shrink-0 items-center gap-1">{header.actions}</div>}
          </div>
        </header>

        <OfflineBanner />
        {access?.accessLevel === 'read_only' && (
          <div role="status" className="border-b border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning">
            {t('shell.readOnly')}
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col">
          {suspended ? (
            <div className="mx-auto max-w-md px-4 py-10 text-center">
              <p className="text-base text-muted-foreground">{t('shell.suspended')}</p>
            </div>
          ) : (
            <ScreenErrorBoundary>
              <Outlet />
            </ScreenErrorBoundary>
          )}
        </main>
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen} title={t('shell.create')}>
        <div className="grid grid-cols-1 gap-2 pb-2">
          <Button
            size="lg"
            className="justify-start"
            onClick={() => {
              setCreateOpen(false)
              navigate('/bookings/new?walkin=1')
            }}
          >
            <UserPlus className="h-5 w-5" aria-hidden />
            {t('shell.walkIn')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="justify-start"
            onClick={() => {
              setCreateOpen(false)
              navigate('/bookings/new')
            }}
          >
            <Plus className="h-5 w-5" aria-hidden />
            {t('shell.newBooking')}
          </Button>
        </div>
      </Sheet>

      {/* Mobile bottom tabs; the centre slot opens walk-in / new booking so it never covers row actions */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden"
        aria-label={t('shell.tabs')}
      >
        <ul className="grid h-[var(--tabbar-h)]" style={{ gridTemplateColumns: `repeat(${tabs.length + (canCreate ? 1 : 0)}, minmax(0, 1fr))` }}>
          {tabs.map(({ to, label, icon: Icon }, i) => (
            <Fragment key={to}>
              {canCreate && i === CREATE_SLOT && (
                <li>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-primary"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Plus className="h-5 w-5" aria-hidden />
                    </span>
                    {t('shell.new')}
                  </button>
                </li>
              )}
              <li>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('h-6 w-6', isActive && 'stroke-[2.25]')} aria-hidden />
                      {t(label)}
                    </>
                  )}
                </NavLink>
              </li>
            </Fragment>
          ))}
        </ul>
      </nav>
    </div>
  )
}
