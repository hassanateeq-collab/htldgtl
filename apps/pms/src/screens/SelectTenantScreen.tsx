import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { homeRouteFor, t, type TenantRole } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { ErrorNote, Loading } from '@/components/patterns/state'
import { useSession } from '@/auth/session'
import { supabase } from '@/lib/supabase'
import { errorMessage, toAppError } from '@/lib/errors'
import { roleLabel } from '@/lib/labels'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/** /select-tenant — signed in but no active tenant: pick one of the user's hotels. */
export default function SelectTenantScreen() {
  const navigate = useNavigate()
  const { session, selectTenant, signOut } = useSession()
  useDocumentTitle(t('auth.chooseHotel'))
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['my-memberships', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_memberships')
      if (error) throw toAppError(error)
      return data
    },
  })

  async function choose(slug: string, role: TenantRole) {
    setError(null)
    setBusySlug(slug)
    try {
      await selectTenant(slug)
      navigate(homeRouteFor(role), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusySlug(null)
    }
  }

  // One hotel: no need to ask.
  useEffect(() => {
    if (query.data?.length === 1 && !busySlug) {
      const only = query.data[0]
      if (only) void choose(only.slug, only.role)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data])

  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} />

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{t('auth.brand')}</p>
      <h1 className="mt-2 text-2xl font-semibold">{t('auth.chooseHotel')}</h1>
      {session?.user.email && <p className="mt-1 text-sm text-muted-foreground">{t('auth.signedInAs', { email: session.user.email })}</p>}

      {query.data.length === 0 ? (
        <p className="mt-6 text-base text-muted-foreground">{t('auth.noMemberships')}</p>
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {query.data.map((m) => (
            <li key={m.tenant_id}>
              <button
                type="button"
                onClick={() => void choose(m.slug, m.role)}
                disabled={busySlug !== null}
                className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent active:bg-accent disabled:opacity-60"
              >
                <div className="flex-1">
                  <p className="text-base font-medium">{m.name}</p>
                  <p className="text-sm text-muted-foreground">{roleLabel(m.role)}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-due">
          {error}
        </p>
      )}

      <Button variant="ghost" className="mt-8" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </Button>
    </main>
  )
}
