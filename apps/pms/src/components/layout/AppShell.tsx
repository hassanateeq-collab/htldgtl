import { NavLink, Outlet } from 'react-router-dom'
import { BedDouble, CalendarDays, ClipboardList, Menu, Sun, type LucideIcon } from 'lucide-react'
import { t, type MessageKey } from '@hotel-digital/shared'
import { cn } from '@/lib/utils'
import { sampleProperty, sampleTenant } from '@/mock/sample-property'

const tabs: { to: string; label: MessageKey; icon: LucideIcon }[] = [
  { to: '/today', label: 'nav.today', icon: Sun },
  { to: '/calendar', label: 'nav.calendar', icon: CalendarDays },
  { to: '/bookings', label: 'nav.bookings', icon: ClipboardList },
  { to: '/rooms', label: 'nav.rooms', icon: BedDouble },
  { to: '/more', label: 'nav.more', icon: Menu },
]

export function AppShell() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {sampleTenant.name}
        </p>
        <h1 className="text-base font-semibold leading-tight">{sampleProperty.name}</h1>
      </header>

      <main>
        <Outlet />
      </main>

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
