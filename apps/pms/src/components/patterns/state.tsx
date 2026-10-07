import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { SkeletonRows } from '@/components/ui/feedback'
import { errorMessage } from '@/lib/errors'

export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40svh] items-center justify-center p-6 text-base text-muted-foreground" role="status" aria-live="polite">
      {label ?? t('common.loading')}
    </div>
  )
}

/** Friendly error with retry; the raw message is only in the console. */
export function ErrorNote({ message, onRetry, error }: { message?: string; onRetry?: () => void; error?: unknown }) {
  if (error) console.error(error)
  return (
    <div role="alert" className="m-4 rounded-lg border border-due-border bg-due-bg p-4 text-base">
      <p className="font-medium text-due">{message ?? (error ? errorMessage(error) : t('common.error'))}</p>
      {onRetry && (
        <Button variant="outline" className="mt-3" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

interface QueryStateProps {
  pending: boolean
  error: unknown
  onRetry?: () => void
  skeleton?: ReactNode
  children: ReactNode
}

/** Pending → skeleton, error → friendly retry, otherwise the content. */
export function QueryState({ pending, error, onRetry, skeleton, children }: QueryStateProps) {
  if (pending) return <>{skeleton ?? <SkeletonRows />}</>
  if (error) return <ErrorNote error={error} onRetry={onRetry} />
  return <>{children}</>
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  )
}

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="flex items-center gap-2 border-b border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      {t('shell.offline')}
    </div>
  )
}

interface BoundaryState {
  error: Error | null
}

/** Catches render errors on a screen so the shell and navigation keep working. */
export class ScreenErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="mx-auto max-w-md px-4 py-10 text-center">
          <p className="text-base font-medium">{t('shell.crashed')}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              {t('common.retry')}
            </Button>
            <Button onClick={() => window.location.reload()}>{t('shell.reload')}</Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
