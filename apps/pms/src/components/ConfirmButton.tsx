import { useEffect, useState, type ReactNode } from 'react'
import { t } from '@hotel-digital/shared'
import { Button, type ButtonProps } from '@/components/ui/button'

/**
 * Two-tap confirmation for consequential actions on a phone: the first tap
 * arms the button for three seconds, the second tap runs the action.
 */
export function ConfirmButton({
  onConfirm,
  busy = false,
  children,
  variant = 'outline',
  ...props
}: Omit<ButtonProps, 'onClick'> & { onConfirm: () => void; busy?: boolean; children: ReactNode }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(id)
  }, [armed])

  return (
    <Button
      {...props}
      variant={armed ? 'destructive' : variant}
      disabled={props.disabled || busy}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
    >
      {busy ? t('actions.working') : armed ? t('actions.tapAgain') : children}
    </Button>
  )
}
