import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * DELETE /api/inbox/conversations/[id]/messages
 *
 * Clears the ADOLF inbox history for one conversation while keeping the
 * conversation, contact, assignment, and WhatsApp connection intact.
 * This only removes ADOLF's stored message history; it does not delete
 * messages from WhatsApp itself.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let accountId: string
  try {
    const ctx = await requireRole('agent')
    accountId = ctx.accountId
  } catch (error) {
    return toErrorResponse(error)
  }

  const admin = supabaseAdmin()

  const { data: conversation, error: conversationError } = await admin
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('account_id', accountId)
    .maybeSingle()

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 })
  }
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const { error: messageError } = await admin
    .from('messages')
    .delete()
    .eq('conversation_id', id)

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 })
  }

  const { error: conversationUpdateError } = await admin
    .from('conversations')
    .update({
      last_message_text: null,
      last_message_at: null,
      unread_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('account_id', accountId)

  if (conversationUpdateError) {
    return NextResponse.json(
      { error: conversationUpdateError.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
