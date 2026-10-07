import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { t } from '@hotel-digital/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------- header context ----
export interface HeaderState {
  title: string
  subtitle?: string
  /** Where "back" goes; `-1` means history back with `fallback`. */
  back?: string | -1
  fallback?: string
  actions?: ReactNode
  /** Hide the hotel name line under the title on mobile. */
  compact?: boolean
}

interface HeaderContextValue {
  header: HeaderState | null
  setHeader: (h: HeaderState | null) => void
}

const HeaderContext = createContext<HeaderContextValue>({ header: null, setHeader: () => {} })

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HeaderState | null>(null)
  return <HeaderContext.Provider value={{ header, setHeader }}>{children}</HeaderContext.Provider>
}

export function useHeader() {
  return useContext(HeaderContext)
}

export function BackButton({ to, fallback = '/today', className }: { to: string | -1; fallback?: string; className?: string }) {
  const navigate = useNavigate()
  if (to === -1) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('common.back')}
        className={className}
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(fallback))}
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </Button>
    )
  }
  return (
    <Button variant="ghost" size="icon" aria-label={t('common.back')} className={className} asChild>
      <Link to={to}>
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </Link>
    </Button>
  )
}

/**
 * Declares the page's title, back target and header actions. On phones the
 * shell's top bar shows them; on desktop the header renders inline. Also sets
 * document.title.
 */
export function PageHeader(props: HeaderState) {
  const { setHeader } = useHeader()
  const { title, subtitle, back, fallback, actions } = props
  useLayoutEffect(() => {
    setHeader(props)
    document.title = `${title} · Hotel Digital`
    return () => setHeader(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, back, fallback, actions])
  return (
    <div className="hidden items-start justify-between gap-4 md:flex">
      <div className="flex min-w-0 items-start gap-2">
        {back !== undefined && <BackButton to={back} fallback={fallback} className="-ml-2 mt-0.5" />}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

// ------------------------------------------------------------------- page ----
interface PageProps {
  children: ReactNode
  /** Content width on desktop. */
  width?: 'md' | 'lg' | 'xl' | 'full'
  /** Reserve space for a fixed bottom action bar on phones. */
  withActionBar?: boolean
  className?: string
}

const widths = { md: 'md:max-w-3xl', lg: 'md:max-w-5xl', xl: 'md:max-w-7xl', full: '' }

/** Owns gutters and the bottom padding that keeps content clear of the tab bar / action bar. */
export function Page({ children, width = 'lg', withActionBar, className }: PageProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full space-y-5 px-4 py-4 md:px-6 md:py-6',
        widths[width],
        withActionBar ? 'pb-[calc(var(--tabbar-h)+var(--actionbar-h)+1rem)] md:pb-8' : 'pb-[calc(var(--tabbar-h)+1rem)] md:pb-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Section heading with an optional count and trailing link. */
export function SectionTitle({ children, count, action }: { children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold">
        {children}
        {count !== undefined && <span className="tnum ml-1.5 font-normal text-muted-foreground">({count})</span>}
      </h2>
      {action}
    </div>
  )
}

/**
 * Primary action(s) for a flow: fixed above the tab bar on phones so the main
 * button is always under the thumb; inline on desktop.
 */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none',
        'bottom-[var(--tabbar-h)]',
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 md:max-w-none">{children}</div>
    </div>
  )
}
