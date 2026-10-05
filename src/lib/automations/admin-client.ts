import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Compatibility facade for the automation engine.
 * All privileged Supabase access now comes from one server-only client.
 */
export function supabaseAdmin(): SupabaseClient {
  return createAdminClient()
}
