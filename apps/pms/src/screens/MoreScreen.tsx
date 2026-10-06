import { BarChart3, Settings, Sparkles, Users, Wallet, type LucideIcon } from 'lucide-react'
import { t, type MessageKey } from '@hotel-digital/shared'

const items: { key: MessageKey; icon: LucideIcon }[] = [
  { key: 'more.guests', icon: Users },
  { key: 'more.housekeeping', icon: Sparkles },
  { key: 'more.reports', icon: BarChart3 },
  { key: 'more.cashHandover', icon: Wallet },
  { key: 'more.settings', icon: Settings },
]

export function MoreScreen() {
  return (
    <div className="mx-auto max-w-md px-4 py-4 pb-24">
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
        {items.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-center gap-3 px-4 py-3">
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium">{t(key)}</p>
              <p className="text-xs text-muted-foreground">{t('more.comingSoon')}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
