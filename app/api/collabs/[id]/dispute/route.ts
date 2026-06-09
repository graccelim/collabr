import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(id, user_id, users(email)), brand_profiles(user_id, users(email))')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const isBrand = brandUserId === user.id
  const isCreator = creatorUserId === user.id
  if (!isBrand && !isCreator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!['live_submitted', 'draft_submitted', 'in_revision', 'draft_approved'].includes(collab.status)) {
    return NextResponse.json({ error: 'Cannot raise a dispute at this collab stage' }, { status: 400 })
  }

  const { reason, evidence_urls } = await req.json()
  if (!reason || reason.length < 20) {
    return NextResponse.json({ error: 'Reason must be at least 20 characters' }, { status: 400 })
  }

  await supabase.from('collabs').update({ status: 'disputed' }).eq('id', params.id)
  await supabase.from('disputes').insert({
    collab_id: params.id,
    raised_by: isBrand ? 'brand' : 'creator',
    reason,
    evidence_urls: evidence_urls || null,
    outcome: 'pending',
  })

  // Notify both parties
  const otherUserId = isBrand ? creatorUserId : brandUserId
  const otherEmail = isBrand
    ? (collab.creator_profiles as any)?.users?.email
    : (collab.brand_profiles as any)?.users?.email
  const raisingEmail = isBrand
    ? (collab.brand_profiles as any)?.users?.email
    : (collab.creator_profiles as any)?.users?.email

  if (otherUserId) await sendNotification({ userId: otherUserId, type: 'dispute_raised',
    title: 'A dispute has been raised on your collab', payload: { collab_id: params.id } })
  if (user.id) await sendNotification({ userId: user.id, type: 'dispute_raised',
    title: 'Dispute submitted — we will review within 3 business days', payload: { collab_id: params.id } })

  if (otherEmail) await emails.disputeRaised(otherEmail, params.id)
  if (raisingEmail) await emails.disputeRaised(raisingEmail, params.id)

  return NextResponse.json({ success: true })
}
