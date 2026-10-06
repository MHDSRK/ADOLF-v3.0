import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export function supabaseAdmin(): SupabaseClient {
  return createAdminClient()
}
