import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { detectContactInfo } from '@/lib/moderation'

// Confirm the signed-in user is a party (creator or brand) of this collab.
// The session client's RLS on collabs already scopes to own collabs, so a
// successful single() read is itself proof of membership.
async function assertParty(supabase: ReturnType<typeof createClient>, collabId: string, userId: string) {
  const { data: collab } = await supabase.from('collabs')
    .select('id, creator_profiles(user_id), brand_profiles(user_id)')
    .eq('id', collabId).single()
  if (!collab) return null
  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const brandUserId = (collab.brand_profiles as any)?.user_id
  if (creatorUserId !== userId && brandUserId !== userId) return null
  return collab
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await assertParty(supabase, params.id, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Flagged messages are never delivered to the thread — they're held in the
  // moderation queue only, so contact info never reaches the other party.
  const { data: messages } = await supabase.from('collab_messages')
    .select('id, sender_id, body, flagged, flag_reasons, created_at')
    .eq('collab_id', params.id)
    .eq('flagged', false)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages || [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await assertParty(supabase, params.id, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const json = await req.json().catch(() => ({}))
  const body = typeof json.body === 'string' ? json.body.trim() : ''
  if (!body) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  if (body.length > 2000) return NextResponse.json({ error: 'Message is too long' }, { status: 400 })

  // Moderation runs server-side so the flag can't be bypassed by the client.
  const { flagged, reasons } = detectContactInfo(body)

  // Insert via admin client: collab_messages has no client insert policy by
  // design, keeping the moderation columns server-controlled. Flagged messages
  // are stored (for the admin review queue) but NOT delivered to the thread —
  // the sender is told it wasn't sent, so contact info never reaches the other
  // party. Only clean messages are returned to the chat.
  const { data: message, error } = await createAdminClient().from('collab_messages')
    .insert({ collab_id: params.id, sender_id: user.id, body, flagged, flag_reasons: reasons })
    .select('id, sender_id, body, flagged, flag_reasons, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (flagged) return NextResponse.json({ blocked: true, reasons })
  return NextResponse.json({ message })
}
