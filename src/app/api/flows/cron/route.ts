import { NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/cron-auth'
import { sweepFlowTimeouts } from '@/lib/cron/jobs'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function GET(request: Request) {
  const authError = requireCronSecret(request)
  if (authError) return authError

  const admin = createAdminClient()
  const { data: acquired, error: lockError } = await admin.rpc(
    'try_acquire_cron_lock',
    { p_name: 'flow-cron', p_ttl_seconds: 240 },
  )
  if (lockError) {
    console.error('[flows-cron] lock acquisition failed:', lockError)
    return NextResponse.json({ error: 'Cron lock unavailable' }, { status: 503 })
  }
  if (!acquired) return NextResponse.json({ skipped: true, reason: 'already_running' })

  try {
    return NextResponse.json(await sweepFlowTimeouts())
  } catch (error) {
    console.error('[flows-cron] failed:', error)
    return NextResponse.json({ error: 'Flow cron failed' }, { status: 500 })
  }
}
