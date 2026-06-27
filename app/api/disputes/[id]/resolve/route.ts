import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { cancelOrRefundPayment, captureTransferAndComplete, completeBarterCollab, settleSplitDispute } from '@/lib/payments'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createAdminClient()
  const { data: dispute } = await admin.from('disputes').select('*, collabs(*)').eq('id', params.id).single()
  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dispute.resolved_at) return NextResponse.json({ error: 'Dispute is already resolved' }, { status: 409 })

  const { outcome, split_percentage, platform_ruling } = await req.json()
  if (!['creator_wins', 'brand_wins', 'split', 'mutual'].includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
  }
  if (outcome === 'split' && (!split_percentage || split_percentage < 0 || split_percentage > 100)) {
    return NextResponse.json({ error: 'split_percentage 0 to 100 required for split outcome' }, { status: 400 })
  }

  const { data: claimed, error: claimError } = await admin.rpc('claim_dispute_resolution', {
    p_dispute_id: params.id,
    p_outcome: outcome,
    p_split_percentage: outcome === 'split' ? split_percentage : null,
    p_platform_ruling: platform_ruling || null,
  })
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 409 })
  if (claimed !== true) return NextResponse.json({ error: 'Dispute is already resolved' }, { status: 409 })

  const collab = dispute.collabs as any
  const isBarter = (collab.agreed_rate ?? 0) === 0
  let settlement
  if (outcome === 'creator_wins' || outcome === 'split') {
    // Barter has no money to capture/split — a creator/split win just completes.
    if (isBarter) {
      settlement = await completeBarterCollab(admin, collab.id)
    } else if (outcome === 'creator_wins') {
      settlement = await captureTransferAndComplete(admin, collab)
    } else {
      // Split: capture the creator's share of the hold; the brand's remainder is
      // released explicitly (verified + recorded). The platform fee is recomputed
      // ON the captured share (same fee fraction as the original collab) so
      // captureAmount = creatorPayout + fee exactly — no rounding drift, and the
      // creator can never be transferred more than was captured.
      const creatorShare = split_percentage || 0
      const captureAmount = Math.round(collab.agreed_rate * (creatorShare / 100))
      const feeFraction = collab.agreed_rate > 0 ? collab.platform_fee / collab.agreed_rate : 0
      const creatorPayout = captureAmount - Math.round(captureAmount * feeFraction)
      settlement = await settleSplitDispute(admin, collab, { captureAmount, creatorPayout })
    }
  } else {
    // brand_wins / mutual → refund/cancel (barter has no money; just cancels).
    settlement = await cancelOrRefundPayment(admin, collab)
    if (settlement.ok) {
      await admin.from('collabs').update({ status: 'cancelled' }).eq('id', collab.id)
    }
  }

  if (!settlement.ok) {
    return NextResponse.json({
      error: `Stripe settlement failed. Dispute remains unresolved: ${settlement.error}`,
    }, { status: 502 })
  }

  const { data: finalized, error: finalizeError } = await admin.rpc('finalize_dispute_resolution', {
    p_dispute_id: params.id,
  })
  if (finalizeError) return NextResponse.json({ error: finalizeError.message }, { status: 500 })

  // Notify both parties
  const { data: collabFull } = await admin.from('collabs')
    .select('creator_profiles(user_id), brand_profiles(user_id)')
    .eq('id', collab.id).single()

  const creatorUserId = (collabFull?.creator_profiles as any)?.user_id
  const brandUserId = (collabFull?.brand_profiles as any)?.user_id
  const outcomeLabelMap: Record<string, string> = { creator_wins: 'Creator wins', brand_wins: 'Brand wins', split: `Split ${split_percentage}%/${100 - split_percentage}%`, mutual: 'Mutual resolution' }
  const outcomeLabel = outcomeLabelMap[outcome] || outcome

  for (const uid of finalized === true ? [creatorUserId, brandUserId].filter(Boolean) : []) {
    await sendNotification({ userId: uid, type: 'dispute_resolved',
      title: `Dispute resolved, ${outcomeLabel}`, payload: { collab_id: collab.id },
      dedupeKey: `dispute:${params.id}:resolved` })
    await sendProductEmail({ userId: uid, ...productEmails.disputeResolved({ collabId: collab.id, disputeId: params.id, outcomeLabel, recipientId: uid, isBarter }) })
  }

  return NextResponse.json({ success: true, outcome, already_resolved: finalized !== true })
}
