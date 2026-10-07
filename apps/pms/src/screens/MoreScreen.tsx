import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart3, ChevronRight, Settings, Sparkles, Users, Wallet, type LucideIcon } from 'lucide-react'
import { t, type MessageKey } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { useSession } from '@/auth/session'
import { useTenant } from '@/data/tenant'

const items: { key: MessageKey; icon: LucideIcon; to?: string }[] = [
  { key: 'more.guests', icon: Users, to: '/guests' },
  { key: 'more.housekeeping', icon: Sparkles },
  { key: 'more.reports', icon: BarChart3 },
  { key: 'more.cashHandover', icon: Wallet },
  { key: 'more.settings', icon: Settings },
]

export function MoreScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, signOut } = useSession()
  const { role } = useTenant()

  async function onSignOut() {
    await signOut()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-24 md:max-w-3xl md:px-6 md:py-6 md:pb-8">
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
        {items.map(({ key, icon: Icon, to }) => {
          const inner = (
            <>
              <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-medium">{t(key)}</p>
                {!to && <p className="text-xs text-muted-foreground">{t('more.comingSoon')}</p>}
              </div>
              {to && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />}
            </>
          )
          return (
            <li key={key}>
              {to ? (
                <Link to={to} className="flex items-center gap-3 px-4 py-3 active:bg-accent">
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        {session?.user.email && (
          <p className="text-sm">{t('auth.signedInAs', { email: session.user.email })}</p>
        )}
        {role && <p className="mt-0.5 text-xs text-muted-foreground">{t(`role.${role}` as MessageKey)}</p>}
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/select-tenant')}>
            {t('auth.switchHotel')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void onSignOut()}>
            {t('auth.signOut')}
          </Button>
        </div>
      </div>
    </div>
  )
}
