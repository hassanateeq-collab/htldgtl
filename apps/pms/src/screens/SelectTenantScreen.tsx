import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { t, type MessageKey, type TenantRole } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { ErrorNote, Loading } from '@/components/State'
import { useSession } from '@/auth/session'
import { supabase } from '@/lib/supabase'

interface MembershipRow {
  tenant_id: string
  slug: string
  name: string
  role: TenantRole
}

const roleLabel = (r: TenantRole) => t(`role.${r}` as MessageKey)

/** /select-tenant — signed in but no active tenant: pick one of the user's hotels. */
export function SelectTenantScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, selectTenant, signOut } = useSession()
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['my-memberships', session?.user.id],
    queryFn: async (): Promise<MembershipRow[]> => {
      const { data, error } = await supabase.rpc('my_memberships')
      if (error) throw error
      return (data ?? []) as MembershipRow[]
    },
  })

  async function choose(slug: string) {
    setError(null)
    setBusySlug(slug)
    try {
      await selectTenant(slug)
      queryClient.clear()
      navigate('/today', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setBusySlug(null)
    }
  }

  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorNote message={query.error.message} onRetry={() => void query.refetch()} />

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Hotel Digital</p>
      <h1 className="mt-1 text-2xl font-semibold">{t('auth.chooseHotel')}</h1>
      {session?.user.email && (
        <p className="mt-1 text-sm text-muted-foreground">
          {t('auth.signedInAs', { email: session.user.email })}
        </p>
      )}

      {query.data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('auth.noMemberships')}</p>
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {query.data.map((m) => (
            <li key={m.tenant_id}>
              <button
                type="button"
                onClick={() => void choose(m.slug)}
                disabled={busySlug !== null}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-accent disabled:opacity-60"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel(m.role)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <Button variant="ghost" className="mt-8" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </Button>
    </div>
  )
}
