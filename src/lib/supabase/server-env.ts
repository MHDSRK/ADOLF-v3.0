const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
}

if (!secretKey) {
  throw new Error(
    'SUPABASE_SECRET_KEY is required (legacy SUPABASE_SERVICE_ROLE_KEY is supported temporarily)',
  )
}

/**
 * Server-only Supabase configuration.
 *
 * The secret key replaces the deprecated service_role key. The legacy name is
 * accepted only as a migration fallback so existing deployments can be moved
 * without downtime.
 */
export const SUPABASE_URL = url
export const SUPABASE_SECRET_KEY = secretKey
