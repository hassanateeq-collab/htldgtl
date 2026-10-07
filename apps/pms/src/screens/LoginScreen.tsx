import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useSession } from '@/auth/session'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

function prettySlug(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** /t/:slug/login — email + password, then stamps the active tenant and enters the app. */
export default function LoginScreen() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { session, loading, signIn, selectTenant, signOut } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoFailed, setAutoFailed] = useState(false)

  // The hotel's real name, when the signed-in user is a member (my_memberships works without a claim).
  const hotelQ = useQuery({
    queryKey: ['login-hotel', slug, session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data } = await supabase.rpc('my_memberships')
      return data?.find((m) => m.slug === slug)?.name ?? null
    },
  })
  const hotelName = hotelQ.data ?? prettySlug(slug)
  useDocumentTitle(t('auth.signInTo', { name: hotelName }))

  // Already signed in (e.g. switching hotels via a link): just select the tenant.
  useEffect(() => {
    if (loading || !session || busy || autoFailed) return
    setBusy(true)
    selectTenant(slug)
      .then(() => navigate('/today', { replace: true }))
      .catch(() => {
        setError(t('auth.noAccess'))
        setAutoFailed(true)
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
      const app = toAppError(err)
      const message = err instanceof Error ? err.message : ''
      if (app.kind === 'offline') setError(t('auth.network'))
      else if (/membership|no membership|access/i.test(message)) setError(t('auth.noAccess'))
      else setError(t('auth.invalid'))
      setBusy(false)
    }
  }

  if (!loading && session && !autoFailed) {
    return (
      <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6 text-center text-base text-muted-foreground" role="status">
        {t('auth.opening', { name: hotelName })}
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{t('auth.brand')}</p>
      <h1 className="mt-2 text-2xl font-semibold">{t('auth.signInTo', { name: hotelName })}</h1>

      {session && autoFailed ? (
        <div className="mt-6 space-y-3">
          <p role="alert" className="text-base text-due">
            {t('auth.noAccess')}
          </p>
          <p className="text-sm text-muted-foreground">{t('auth.signedInAs', { email: session.user.email ?? '' })}</p>
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            {t('auth.notYou')}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label={t('auth.email')}>
            <Input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Field label={t('auth.password')}>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
              </Button>
            </div>
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-due">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
          <p className="text-center text-sm text-muted-foreground">{t('auth.forgot')}</p>
        </form>
      )}

      <Link to="/login" className="mt-8 text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
        {t('auth.switchHotel')}
      </Link>
    </main>
  )
}
