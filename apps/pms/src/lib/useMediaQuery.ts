import { useSyncExternalStore } from 'react'

/** True when the CSS media query matches; updates live on resize/rotation. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Tailwind `md` breakpoint — where the app switches to the desktop shell. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
