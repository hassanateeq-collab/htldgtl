import { useEffect, useState } from 'react'

/** True when the CSS media query matches; updates live on resize/rotation. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Tailwind `md` breakpoint — the point where the app switches to the desktop shell. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
