import type { SupabaseClient } from '@supabase/supabase-js'
import { getMediaUrl } from '@/lib/whatsapp/meta-api'
import { mirrorInboundMedia } from '@/lib/whatsapp/mirror-inbound-media'
import { resolveConversationByPhone } from '@/lib/whatsapp/resolve-conversation'

type MessageEcho = {
  id: string
  from?: string
  to?: string
  timestamp: string
  type: string
  text?: { body?: string }
  image?: { id?: string; mime_type?: string; caption?: string }
  video?: { id?: string; mime_type?: string; caption?: string }
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string }
  audio?: { id?: string; mime_type?: string }
  sticker?: { id?: string; mime_type?: string }
  location?: { latitude?: number; longitude?: number; name?: string; address?: string }
}

type EchoChangeValue = {
  metadata?: { phone_number_id?: string }
  message_echoes?: MessageEcho[]
}

export type CoexistenceEchoChange = {
  field: string
  value: EchoChangeValue
}

function echoContent(echo: MessageEcho) {
  switch (echo.type) {
    case 'text': return { contentType: 'text', contentText: echo.text?.body ?? null, mediaUrl: null, mediaType: null, mediaId: null }
    case 'image': return { contentType: 'image', contentText: echo.image?.caption ?? null, mediaUrl: echo.image?.id ? '/api/whatsapp/media/' + echo.image.id : null, mediaType: echo.image?.mime_type ?? null, mediaId: echo.image?.id ?? null }
    case 'video': return { contentType: 'video', contentText: echo.video?.caption ?? null, mediaUrl: echo.video?.id ? '/api/whatsapp/media/' + echo.video.id : null, mediaType: echo.video?.mime_type ?? null, mediaId: echo.video?.id ?? null }
    case 'document': return { contentType: 'document', contentText: echo.document?.caption ?? echo.document?.filename ?? null, mediaUrl: echo.document?.id ? '/api/whatsapp/media/' + echo.document.id : null, mediaType: echo.document?.mime_type ?? null, mediaId: echo.document?.id ?? null }
    case 'audio': return { contentType: 'audio', contentText: null, mediaUrl: echo.audio?.id ? '/api/whatsapp/media/' + echo.audio.id : null, mediaType: echo.audio?.mime_type ?? null, mediaId: echo.audio?.id ?? null }
    case 'sticker': return { contentType: 'image', contentText: null, mediaUrl: echo.sticker?.id ? '/api/whatsapp/media/' + echo.sticker.id : null, mediaType: echo.sticker?.mime_type ?? null, mediaId: echo.sticker?.id ?? null }
    case 'location': {
      const loc = echo.location
      const contentText = loc ? [loc.name, loc.address, loc.latitude != null && loc.longitude != null ? String(loc.latitude) + ',' + String(loc.longitude) : null].filter(Boolean).join(' - ') : null
      return { contentType: 'location', contentText, mediaUrl: null, mediaType: null, mediaId: null }
    }
    default: return { contentType: 'text', contentText: null, mediaUrl: null, mediaType: null, mediaId: null }
  }
}

/**
 * Mirrors messages sent from the WhatsApp Business app during Cloud API
 * coexistence into the ADOLF conversation history.
 */
export async function processCoexistenceEchoes(args: {
  db: SupabaseClient
  change: CoexistenceEchoChange
  accountId: string
  configOwnerUserId: string
  whatsappConfigId: string
  accessToken: string
  mirrorMedia: boolean
}): Promise<void> {
  const echoes = args.change.value.message_echoes ?? []

  for (const echo of echoes) {
    if (!echo.id || !echo.to) {
      console.warn('[webhook] coexistence echo missing id or recipient; skipping')
      continue
    }

    const conversation = await resolveConversationByPhone(
      args.db, args.accountId, echo.to, null, args.whatsappConfigId,
    ).catch((error) => {
      console.error('[webhook] failed to resolve coexistence echo conversation:', error)
      return null
    })
    if (!conversation) continue

    const parsed = echoContent(echo)
    let mediaUrl = parsed.mediaUrl
    if (parsed.mediaId && args.mirrorMedia) {
      try {
        const media = await getMediaUrl({ mediaId: parsed.mediaId, accessToken: args.accessToken })
        const mirrored = await mirrorInboundMedia({
          storage: args.db.storage,
          accountId: args.accountId,
          mediaId: parsed.mediaId,
          downloadUrl: media.url,
          accessToken: args.accessToken,
          mimeType: media.mimeType,
          fileSize: media.fileSize,
          fileName: echo.document?.filename,
          messageTimestamp: echo.timestamp,
        })
        if (mirrored) mediaUrl = mirrored
      } catch (error) {
        console.error('[webhook] failed to mirror coexistence echo media:', error instanceof Error ? error.message : error)
      }
    }

    const createdAt = new Date(parseInt(echo.timestamp, 10) * 1000).toISOString()
    const { data: insertedRows, error: insertError } = await args.db.from('messages').upsert({
      conversation_id: conversation.conversationId,
      sender_type: 'agent',
      sender_id: args.configOwnerUserId,
      content_type: parsed.contentType,
      content_text: parsed.contentText,
      media_url: mediaUrl,
      media_type: parsed.mediaType,
      message_id: echo.id,
      status: 'sent',
      created_at: createdAt,
    }, { onConflict: 'conversation_id,message_id', ignoreDuplicates: true }).select('id')

    if (insertError) {
      console.error('[webhook] failed to persist coexistence echo:', insertError)
      continue
    }
    if (!insertedRows || insertedRows.length === 0) continue

    const { error: conversationError } = await args.db.from('conversations').update({
      last_message_text: parsed.contentText ?? '[' + parsed.contentType + ']',
      last_message_at: createdAt,
      updated_at: new Date().toISOString(),
    }).eq('id', conversation.conversationId)
    if (conversationError) console.error('[webhook] failed to update conversation for coexistence echo:', conversationError)
  }
}