const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
}

if (!publishableKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required (legacy NEXT_PUBLIC_SUPABASE_ANON_KEY is supported temporarily)',
  )
}

/**
 * Browser-safe Supabase configuration.
 *
 * The publishable key replaces the deprecated anon key. The legacy name is
 * accepted only as a migration fallback so existing deployments do not break
 * before their Vercel environment variables are updated.
 */
export const SUPABASE_URL = url
export const SUPABASE_PUBLISHABLE_KEY = publishableKey
