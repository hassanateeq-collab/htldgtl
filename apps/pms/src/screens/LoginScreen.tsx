import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { useSession } from '@/auth/session'

const inputClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function prettySlug(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** /t/:slug/login — email + password, then stamps the active tenant and enters the app. */
export function LoginScreen() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { session, loading, signIn, selectTenant } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already signed in (e.g. switching hotels via a link): just select the tenant.
  useEffect(() => {
    if (loading || !session || busy) return
    setBusy(true)
    selectTenant(slug)
      .then(() => navigate('/today', { replace: true }))
      .catch(() => {
        setError(t('auth.noAccess'))
        setBusy(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.user.id, slug])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      await selectTenant(slug)
      navigate('/today', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(/membership|access/i.test(message) ? t('auth.noAccess') : t('auth.invalid'))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Hotel Digital</p>
      <h1 className="mt-1 text-2xl font-semibold">{t('auth.signInTo', { name: prettySlug(slug) })}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t('auth.email')}</span>
          <input
            className={inputClass}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t('auth.password')}</span>
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
      <Link to="/login" className="mt-6 text-center text-xs text-muted-foreground">
        {t('auth.switchHotel')}
      </Link>
    </div>
  )
}
