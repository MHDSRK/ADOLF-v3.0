import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

type WebhookEnvelope = {
  entry?: Array<{
    id?: string
    changes?: Array<{
      field?: string
      value?: {
        metadata?: { phone_number_id?: string }
        messages?: Array<{ id?: string }>
        statuses?: Array<{ id?: string }>
      }
    }>
  }>
}

const admin = createAdminClient

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

/**
 * Record only enough metadata to answer:
 *   "Did Meta reach our webhook, and what kind of event did it send?"
 *
 * Deliberately does NOT persist the raw payload, message text, names,
 * customer phone numbers, or access tokens.
 */
export async function recordWebhookDelivery(
  rawBody: string,
  body: WebhookEnvelope
): Promise<string | null> {
  const entries = body.entry ?? []
  const changes = entries.flatMap((entry) => entry.changes ?? [])

  const fields = unique(changes.map((change) => change.field))
  const phoneNumberIds = unique(
    changes.map((change) => change.value?.metadata?.phone_number_id)
  )
  const messageIds = unique(
    changes.flatMap((change) => (change.value?.messages ?? []).map((message) => message.id))
  )
  const statusIds = unique(
    changes.flatMap((change) => (change.value?.statuses ?? []).map((status) => status.id))
  )
  const wabaId = entries.map((entry) => entry.id).find(Boolean) ?? null
  const payloadHash = createHash('sha256').update(rawBody).digest('hex')

  const { data, error } = await admin()
    .from('whatsapp_webhook_deliveries')
    .insert({
      payload_hash: payloadHash,
      waba_id: wabaId,
      fields,
      phone_number_ids: phoneNumberIds,
      message_ids: messageIds,
      status_ids: statusIds,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[webhook] diagnostic insert failed:', error)
    return null
  }

  return data.id
}

export async function finishWebhookDelivery(
  id: string,
  outcome: 'processed' | 'failed',
  errorMessage?: string
): Promise<void> {
  const { error } = await admin()
    .from('whatsapp_webhook_deliveries')
    .update({
      outcome,
      processed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    })
    .eq('id', id)

  if (error) {
    console.error('[webhook] diagnostic update failed:', error)
  }
}
