import { supabaseAdmin as automationAdmin } from '@/lib/automations/admin-client'
import { resumePendingExecution, type AutomationContext } from '@/lib/automations/engine'
import { supabaseAdmin as flowAdmin } from '@/lib/flows/admin-client'
import { resolveFallbackPolicy } from '@/lib/flows/fallback'

export async function runAutomationCron(): Promise<{ processed: number }> {
  const admin = automationAdmin()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString()

  const { data: due, error } = await admin
    .from('automation_pending_executions')
    .select('*')
    .or(
      'and(status.eq.pending,run_at.lte.' + now.toISOString() + '),and(status.eq.running,claimed_at.lt.' + staleBefore + ')',
    )
    .order('run_at', { ascending: true })
    .limit(50)

  if (error) throw new Error(`automation queue read failed: ${error.message}`)
  if (!due?.length) return { processed: 0 }

  let processed = 0
  for (const row of due) {
    const { data: claim, error: claimError } = await admin
      .from('automation_pending_executions')
      .update({
        status: 'running',
        claimed_at: new Date().toISOString(),
        attempts: ((row.attempts as number | null) ?? 0) + 1,
      })
      .eq('id', row.id)
      .or(
        'status.eq.pending,and(status.eq.running,claimed_at.lt.' + staleBefore + ')',
      )
      .select('id')
      .maybeSingle()

    if (claimError || !claim) continue

    await resumePendingExecution({
      id: row.id as string,
      automation_id: row.automation_id as string,
      account_id: row.account_id as string,
      user_id: row.user_id as string,
      contact_id: (row.contact_id as string | null) ?? null,
      log_id: (row.log_id as string | null) ?? null,
      parent_step_id: (row.parent_step_id as string | null) ?? null,
      branch: (row.branch as 'yes' | 'no' | null) ?? null,
      next_step_position: row.next_step_position as number,
      context: (row.context as AutomationContext) ?? {},
    })
    processed++
  }

  return { processed }
}

export async function sweepFlowTimeouts(): Promise<{ swept: number }> {
  const admin = flowAdmin()
  const now = new Date()

  const { data: runs, error } = await admin
    .from('flow_runs')
    .select(
      'id, flow_id, user_id, contact_id, last_advanced_at, flows ( fallback_policy )',
    )
    .eq('status', 'active')
    .order('last_advanced_at', { ascending: true })
    .limit(500)

  if (error) throw new Error(`flow timeout scan failed: ${error.message}`)
  if (!runs?.length) return { swept: 0 }

  type Row = {
    id: string
    flow_id: string
    user_id: string
    contact_id: string | null
    last_advanced_at: string
    flows: { fallback_policy: unknown } | { fallback_policy: unknown }[] | null
  }

  let swept = 0
  for (const r of runs as Row[]) {
    const flowsField = Array.isArray(r.flows) ? r.flows[0] : r.flows
    const policy = resolveFallbackPolicy(flowsField?.fallback_policy ?? null)
    const ageHours =
      (now.getTime() - new Date(r.last_advanced_at).getTime()) /
      (1000 * 60 * 60)

    if (ageHours < policy.on_timeout_hours) continue

    const { data: updated, error: updateError } = await admin
      .from('flow_runs')
      .update({
        status: 'timed_out',
        ended_at: now.toISOString(),
        end_reason: 'stale_sweep',
      })
      .eq('id', r.id)
      .eq('status', 'active')
      .select('id')

    if (updateError) {
      console.error('[flows-cron] timeout update failed:', updateError.message)
      continue
    }

    if (updated?.length) {
      const { error: eventError } = await admin.from('flow_run_events').insert({
        flow_run_id: r.id,
        event_type: 'timeout',
        payload: {
          age_hours: Math.round(ageHours * 10) / 10,
          policy_hours: policy.on_timeout_hours,
        },
      })
      if (eventError) {
        console.error('[flows-cron] timeout event insert failed:', eventError.message)
      }
      swept++
    }
  }

  return { swept }
}