import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, ChevronRight, LogOut, MessageCircle, Settings, Sparkles, Users, Wallet, type LucideIcon } from 'lucide-react'
import { t, type Ability, type MessageKey } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Page, PageHeader } from '@/components/patterns/Page'
import { useSession } from '@/auth/session'
import { useTenant } from '@/data/tenant'
import { roleLabel } from '@/lib/labels'

const ITEMS: { key: MessageKey; icon: LucideIcon; to: string; ability?: Ability }[] = [
  { key: 'nav.guests', icon: Users, to: '/guests' },
  { key: 'nav.housekeeping', icon: Sparkles, to: '/housekeeping' },
  { key: 'nav.cash', icon: Wallet, to: '/cash' },
  { key: 'nav.reports', icon: BarChart3, to: '/reports/daily', ability: 'reports.view' },
  { key: 'nav.settings', icon: Settings, to: '/settings', ability: 'settings.manage' },
]

const SUPPORT_URL = 'https://wa.me/?text=Hotel%20Digital%20support'

export default function MoreScreen() {
  const navigate = useNavigate()
  const { session, signOut } = useSession()
  const { tenant, property, role, can } = useTenant()

  async function onSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <Page width="md">
      <PageHeader title={t('more.title')} subtitle={property.name} />
      <Card>
        <ul className="divide-y divide-border">
          {ITEMS.filter((i) => !i.ability || can(i.ability)).map(({ key, icon: Icon, to }) => (
            <li key={key}>
              <Link to={to} className="flex min-h-touch items-center gap-3 px-4 py-3 hover:bg-accent/60 active:bg-accent">
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-base font-medium">{t(key)}</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
          <li>
            <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="flex min-h-touch items-center gap-3 px-4 py-3 hover:bg-accent/60 active:bg-accent">
              <MessageCircle className="h-5 w-5 text-muted-foreground" aria-hidden />
              <span className="flex-1 text-base font-medium">{t('shell.support')}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
            </a>
          </li>
        </ul>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('more.hotel')}</p>
        <p className="mt-1 text-base font-medium">{property.name}</p>
        <p className="text-sm text-muted-foreground">{tenant.name}</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('more.account')}</p>
        {session?.user.email && <p className="mt-1 text-base">{session.user.email}</p>}
        {role && <p className="text-sm text-muted-foreground">{roleLabel(role)}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/select-tenant')}>
            {t('auth.switchHotel')}
          </Button>
          <Button variant="ghost" onClick={() => void onSignOut()}>
            <LogOut className="h-4 w-4" aria-hidden />
            {t('auth.signOut')}
          </Button>
        </div>
      </Card>
    </Page>
  )
}
