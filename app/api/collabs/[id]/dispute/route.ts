import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails, sendDisputeAdminEmail, link } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, campaigns(title), creator_profiles(id, user_id, users(display_name, email)), brand_profiles(user_id, company_name, users(email))')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const isBrand = brandUserId === user.id
  const isCreator = creatorUserId === user.id
  if (!isBrand && !isCreator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!['live_submitted', 'draft_submitted', 'in_revision', 'draft_approved', 'disputed'].includes(collab.status)) {
    return NextResponse.json({ error: 'Cannot raise a dispute at this collab stage' }, { status: 400 })
  }

  const { reason, evidence_urls } = await req.json()
  if (!reason || reason.length < 20) {
    return NextResponse.json({ error: 'Reason must be at least 20 characters' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: result, error } = await admin.rpc('raise_dispute_atomic', {
    p_collab_id: params.id,
    p_raised_by: isBrand ? 'brand' : 'creator',
    p_reason: reason,
    p_evidence_urls: evidence_urls || [],
  }).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  const created = (result as any)?.created === true
  const disputeId = (result as any)?.dispute_id

  // Notify both parties
  const otherUserId = isBrand ? creatorUserId : brandUserId
  const otherEmail = isBrand
    ? (collab.creator_profiles as any)?.users?.email
    : (collab.brand_profiles as any)?.users?.email
  const raisingEmail = isBrand
    ? (collab.brand_profiles as any)?.users?.email
    : (collab.creator_profiles as any)?.users?.email

  if (otherUserId && created) await sendNotification({ userId: otherUserId, type: 'dispute_raised',
    title: 'A dispute has been raised on your collab', payload: { collab_id: params.id },
    dedupeKey: `dispute:${disputeId}:raised` })
  if (user.id && created) await sendNotification({ userId: user.id, type: 'dispute_raised',
    title: 'Dispute submitted, we will review within 3 business days', payload: { collab_id: params.id },
    dedupeKey: `dispute:${disputeId}:raised` })

  const isBarter = ((collab as any).agreed_rate ?? 0) === 0
  if (created) {
    if (otherEmail && otherUserId) await sendProductEmail({ to: otherEmail, ...productEmails.disputeOpened({ collabId: params.id, disputeId: String(disputeId), recipientId: otherUserId, isBarter }) })
    if (raisingEmail) await sendProductEmail({ to: raisingEmail, ...productEmails.disputeOpened({ collabId: params.id, disputeId: String(disputeId), recipientId: user.id, isBarter }) })

    // Mirror to the mediation inbox with full context (disputes are manual).
    // Same subject + threadKey as evidence emails → one Gmail conversation.
    const title = (collab.campaigns as any)?.title || 'collab'
    const creatorName = (collab.creator_profiles as any)?.users?.display_name || '—'
    const creatorMail = (collab.creator_profiles as any)?.users?.email
    const brandName = (collab.brand_profiles as any)?.company_name || '—'
    const openerName = isBrand ? brandName : creatorName
    await sendDisputeAdminEmail(`Dispute · ${title}`, {
      Event: 'Opened',
      Campaign: title,
      Creator: creatorMail ? `${creatorName} <${creatorMail}>` : creatorName,
      Brand: brandName,
      'Opened by': `${openerName} (${isBrand ? 'Brand' : 'Creator'})${raisingEmail ? ` <${raisingEmail}>` : ''}`,
      Reason: reason,
      Collab: link(`/collabs/${params.id}`),
    }, String(disputeId)).catch(() => {})
  }

  return NextResponse.json({ success: true, created, dispute_id: disputeId })
}
