import { NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/cron-auth'
import { runAutomationCron, sweepFlowTimeouts } from '@/lib/cron/jobs'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function GET(request: Request) {
  const authError = requireCronSecret(request)
  if (authError) return authError

  const admin = createAdminClient()
  const { data: acquired, error: lockError } = await admin.rpc(
    'try_acquire_cron_lock',
    { p_name: 'scheduled-workers', p_ttl_seconds: 240 },
  )

  if (lockError) {
    console.error('[cron] lock acquisition failed:', lockError)
    return NextResponse.json({ error: 'Cron lock unavailable' }, { status: 503 })
  }

  if (!acquired) {
    return NextResponse.json({ skipped: true, reason: 'already_running' })
  }

  const [automations, flows] = await Promise.allSettled([
    runAutomationCron(),
    sweepFlowTimeouts(),
  ])

  const errors: string[] = []
  if (automations.status === 'rejected') {
    errors.push(
      automations.reason instanceof Error
        ? automations.reason.message
        : String(automations.reason),
    )
  }
  if (flows.status === 'rejected') {
    errors.push(
      flows.reason instanceof Error
        ? flows.reason.message
        : String(flows.reason),
    )
  }

  if (errors.length) {
    console.error('[cron] scheduled worker failure:', errors)
    return NextResponse.json(
      { error: 'One or more scheduled workers failed', details: errors },
      { status: 500 },
    )
  }

  const automationResult = automations.status === 'fulfilled' ? automations.value : null
  const flowResult = flows.status === 'fulfilled' ? flows.value : null

  return NextResponse.json({
    automations: automationResult,
    flows: flowResult,
  })
}
