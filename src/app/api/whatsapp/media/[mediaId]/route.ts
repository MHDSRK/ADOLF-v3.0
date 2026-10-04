import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Resolve the caller's account_id — whatsapp_config is one-per-
    // account post-multi-user, so a teammate fetching media for a
    // conversation in the shared inbox needs the account's config,
    // not their personal (non-existent) row.
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    // Resolve the WhatsApp connection from the message that owns this
    // media id. Media IDs are not a safe account-wide credential key once
    // multiple business numbers exist.
    const { data: messageRow, error: messageError } = await supabase
      .from('messages')
      .select('conversation_id, conversations!inner(account_id, whatsapp_config_id)')
      .eq('media_url', `/api/whatsapp/media/${mediaId}`)
      .limit(1)
      .maybeSingle()

    if (messageError || !messageRow) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 },
      )
    }

    const conversation = Array.isArray(messageRow.conversations)
      ? messageRow.conversations[0]
      : messageRow.conversations
    const configId = conversation?.whatsapp_config_id as string | null | undefined

    if (!configId || conversation?.account_id !== accountId) {
      return NextResponse.json(
        { error: 'WhatsApp connection for this media is unavailable' },
        { status: 404 },
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('id', configId)
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError || !config || config.status !== 'connected') {
      return NextResponse.json(
        { error: 'WhatsApp connection is unavailable' },
        { status: 400 },
      )
    }

    const accessToken = decrypt(config.access_token)

    // Get the download URL from Meta
    const mediaInfo = await getMediaUrl({ mediaId, accessToken })

    // Download the binary data
    const { buffer, contentType } = await downloadMedia({
      downloadUrl: mediaInfo.url,
      accessToken,
    })

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType || mediaInfo.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Error in WhatsApp media GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}
