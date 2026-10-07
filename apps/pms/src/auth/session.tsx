import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { setLastSlug } from './storage'

interface SessionContextValue {
  loading: boolean
  session: Session | null
  /** From the JWT: app_metadata.active_tenant, set only by set_active_tenant(). */
  activeTenantId: string | null
  signIn: (email: string, password: string) => Promise<void>
  /** Verifies membership server-side, stamps the claim, refreshes the JWT, clears cached data. */
  selectTenant: (slug: string) => Promise<string>
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionContextValue | null>(null)

function tenantFrom(session: Session | null): string | null {
  const value: unknown = session?.user.app_metadata?.active_tenant
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session)
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (mounted) setLoading(false)
      })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const selectTenant = useCallback(
    async (slug: string) => {
      const { error } = await supabase.rpc('set_active_tenant', { p_slug: slug })
      if (error) throw error
      const { data, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError
      // Nothing from the previous hotel may survive the switch.
      queryClient.clear()
      setSession(data.session)
      const tenantId = tenantFrom(data.session)
      if (!tenantId) throw new Error('Active tenant missing after refresh')
      setLastSlug(slug)
      return tenantId
    },
    [queryClient],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<SessionContextValue>(
    () => ({ loading, session, activeTenantId: tenantFrom(session), signIn, selectTenant, signOut }),
    [loading, session, signIn, selectTenant, signOut],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionContextValue {
  const value = useContext(Ctx)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
