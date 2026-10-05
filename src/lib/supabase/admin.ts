import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from './server-env'

let adminClient: SupabaseClient | null = null

/**
 * Create the single privileged Supabase client used by server-only workers.
 *
 * This is intentionally isolated from the browser/SSR clients. A secret key
 * bypasses RLS, so callers MUST scope every tenant-owned query explicitly.
 */
export function createAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return adminClient
}
