// Per-device convenience only: remember the last hotel code so a returning
// receptionist lands on the right login page. Never relied on for security.
const KEY = 'hd.lastSlug'

export function getLastSlug(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setLastSlug(slug: string): void {
  try {
    localStorage.setItem(KEY, slug)
  } catch {
    // storage unavailable (private mode, etc.) — ignore
  }
}
