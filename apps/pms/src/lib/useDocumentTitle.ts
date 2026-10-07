import { useEffect } from 'react'

/** Sets the browser tab title for screens outside the shell (sign-in, tenant picker, print views). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Hotel Digital`
  }, [title])
}
