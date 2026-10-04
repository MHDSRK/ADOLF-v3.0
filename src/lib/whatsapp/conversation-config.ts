import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'

export interface ConversationMetaCredentials {
  configId: string
  phoneNumberId: string
  accessToken: string
  wabaId: string | null
}

/**
 * Resolve the Meta credentials for an existing conversation.
 *
 * The conversation is the source of truth for the sending channel. The
 * account fallback is intentionally limited to legacy rows with no
 * whatsapp_config_id: before multi-number support an account could only
 * have one config, so falling back preserves old data while the migration
 * is applied. New conversations must carry a config id.
 */
export async function loadConversationMetaCredentials(
  db: SupabaseClient,
  accountId: string,
  conversationId: string,
): Promise<ConversationMetaCredentials> {
  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('whatsapp_config_id')
    .eq('id', conversationId)
    .eq('account_id', accountId)
    .maybeSingle()

  if (conversationError || !conversation) {
    throw new Error('Conversation not found')
  }

  let configId = conversation.whatsapp_config_id as string | null

  if (!configId) {
    const { data: legacyConfig, error: legacyError } = await db
      .from('whatsapp_config')
      .select('id')
      .eq('account_id', accountId)
      .eq('status', 'connected')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (legacyError || !legacyConfig) {
      throw new Error('WhatsApp not configured for this conversation')
    }
    configId = legacyConfig.id
  }

  const { data: config, error: configError } = await db
    .from('whatsapp_config')
    .select('id, phone_number_id, access_token, waba_id, status')
    .eq('id', configId)
    .eq('account_id', accountId)
    .maybeSingle()

  if (configError || !config) {
    throw new Error('WhatsApp connection for this conversation was not found')
  }

  if (config.status !== 'connected') {
    throw new Error('WhatsApp connection for this conversation is disconnected')
  }

  return {
    configId: config.id,
    phoneNumberId: config.phone_number_id,
    accessToken: decrypt(config.access_token),
    wabaId: config.waba_id ?? null,
  }
}
