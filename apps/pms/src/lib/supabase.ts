import { createClient } from '@supabase/supabase-js'
import type { Database } from '@hotel-digital/shared'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)')
}

/**
 * Browser client, typed against the generated schema. Uses the publishable key;
 * Row Level Security is the real boundary. The active tenant is carried in the
 * JWT (app_metadata.active_tenant) and read by current_tenant_id() in every
 * policy.
 */
export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
