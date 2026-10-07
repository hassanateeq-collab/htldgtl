import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { t } from '@hotel-digital/shared'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Sticky footer, usually the primary action. */
  footer?: ReactNode
  /** Desktop dialog width. */
  size?: 'md' | 'lg'
  /** Prevent closing by tapping outside while a mutation is running. */
  busy?: boolean
}

/**
 * One API, two shapes: a bottom drawer on phones (thumb reach, swipe to
 * dismiss), a centred dialog on desktop. Flows that interrupt the page —
 * check-in, check-out, payments, moves, reasons — all use this.
 */
export function Sheet({ open, onOpenChange, title, description, children, footer, size = 'md', busy }: SheetProps) {
  const desktop = useIsDesktop()
  const guard = (next: boolean) => {
    if (!next && busy) return
    onOpenChange(next)
  }

  if (!desktop) {
    return (
      <Drawer.Root open={open} onOpenChange={guard} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94svh] flex-col rounded-t-2xl bg-card text-card-foreground shadow-2xl outline-none"
            aria-describedby={description ? undefined : undefined}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />
            <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
              <div className="min-w-0">
                <Drawer.Title className="text-lg font-semibold leading-tight">{title}</Drawer.Title>
                {description ? (
                  <Drawer.Description className="mt-0.5 text-sm text-muted-foreground">{description}</Drawer.Description>
                ) : (
                  <Drawer.Description className="sr-only">{title}</Drawer.Description>
                )}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={t('common.close')} onClick={() => guard(false)}>
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
            {footer && <div className="safe-bottom shrink-0 border-t border-border bg-card px-4 py-3">{footer}</div>}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={guard}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-card text-card-foreground shadow-2xl outline-none',
            size === 'lg' ? 'max-w-2xl' : 'max-w-md',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold leading-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('common.close')}>
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
