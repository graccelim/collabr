import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { cancelOrRefundPayment, captureTransferAndComplete } from '@/lib/payments'

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
    return NextResponse.json({ error: 'split_percentage 0–100 required for split outcome' }, { status: 400 })
  }

  const collab = dispute.collabs as any
  let settlement
  if (outcome === 'creator_wins') {
    settlement = await captureTransferAndComplete(admin, collab)
  } else if (outcome === 'split') {
    const creatorShare = split_percentage || 0
    settlement = await captureTransferAndComplete(admin, collab, {
      captureAmount: Math.round(collab.agreed_rate * (creatorShare / 100)),
      creatorPayout: Math.round(collab.creator_payout * (creatorShare / 100)),
    })
  } else {
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

  await admin.from('disputes').update({
    outcome,
    split_percentage: split_percentage || null,
    platform_ruling: platform_ruling || null,
    resolved_at: new Date().toISOString(),
  }).eq('id', params.id)

  // Notify both parties
  const { data: collabFull } = await admin.from('collabs')
    .select('creator_profiles(user_id), brand_profiles(user_id)')
    .eq('id', collab.id).single()

  const creatorUserId = (collabFull?.creator_profiles as any)?.user_id
  const brandUserId = (collabFull?.brand_profiles as any)?.user_id
  const outcomeLabelMap: Record<string, string> = { creator_wins: 'Creator wins', brand_wins: 'Brand wins', split: `Split ${split_percentage}%/${100 - split_percentage}%`, mutual: 'Mutual resolution' }
  const outcomeLabel = outcomeLabelMap[outcome] || outcome

  for (const uid of [creatorUserId, brandUserId].filter(Boolean)) {
    await sendNotification({ userId: uid, type: 'dispute_resolved',
      title: `Dispute resolved — ${outcomeLabel}`, payload: { collab_id: collab.id } })
  }

  return NextResponse.json({ success: true, outcome })
}
