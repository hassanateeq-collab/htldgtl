import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'

export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40svh] items-center justify-center p-6 text-sm text-muted-foreground">
      {label ?? t('common.loading')}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-medium text-destructive">{t('common.error')}</p>
      {message && <p className="mt-1 break-words text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}
