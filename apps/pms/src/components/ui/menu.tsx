import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

/** Overflow menu for secondary actions (Edit, Move room, Cancel …). */
export function Menu({ trigger, children, align = 'end' }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl outline-none"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function MenuItem({
  className,
  icon,
  destructive,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { icon?: ReactNode; destructive?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex h-11 cursor-pointer select-none items-center gap-3 rounded-md px-3 text-base outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent',
        destructive && 'text-due data-[highlighted]:bg-due-bg',
        className,
      )}
      {...props}
    >
      {icon && <span className="flex h-5 w-5 items-center justify-center text-muted-foreground">{icon}</span>}
      {children}
    </DropdownMenu.Item>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</DropdownMenu.Label>
}
