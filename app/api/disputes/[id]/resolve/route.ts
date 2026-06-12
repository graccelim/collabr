import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { formatSGD } from '@/lib/utils'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createAdminClient()
  const { data: dispute } = await admin.from('disputes').select('*, collabs(*)').eq('id', params.id).single()
  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { outcome, split_percentage, platform_ruling } = await req.json()
  if (!['creator_wins', 'brand_wins', 'split', 'mutual'].includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
  }
  if (outcome === 'split' && (!split_percentage || split_percentage < 0 || split_percentage > 100)) {
    return NextResponse.json({ error: 'split_percentage 0–100 required for split outcome' }, { status: 400 })
  }

  const collab = dispute.collabs as any
  const intentId = collab?.stripe_payment_intent_id

  // Handle Stripe payment based on outcome
  if (intentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(intentId)
      if (intent.status === 'requires_capture') {
        if (outcome === 'creator_wins') {
          await stripe.paymentIntents.capture(intentId)
        } else if (outcome === 'brand_wins' || outcome === 'mutual') {
          await stripe.paymentIntents.cancel(intentId)
        } else if (outcome === 'split' && split_percentage) {
          const captureAmount = Math.round(collab.agreed_rate * (split_percentage / 100))
          await stripe.paymentIntents.capture(intentId, { amount_to_capture: captureAmount })
        }
      }
    } catch (e) {
      console.error('[DISPUTE RESOLVE] Stripe error:', e)
    }
  }

  // Update collab status
  const collabStatus = outcome === 'creator_wins' || outcome === 'split' ? 'completed' : 'cancelled'
  await admin.from('collabs').update({ status: collabStatus }).eq('id', collab.id)

  // Update creator stats for wins
  if ((outcome === 'creator_wins' || outcome === 'split') && collab.creator_id) {
    const payoutAmount = outcome === 'creator_wins'
      ? collab.creator_payout
      : Math.round(collab.creator_payout * ((split_percentage || 50) / 100))

    const { data: creator } = await admin.from('creator_profiles')
      .select('collabs_completed, total_earned').eq('id', collab.creator_id).single()
    if (creator) {
      await admin.from('creator_profiles').update({
        collabs_completed: (creator.collabs_completed || 0) + 1,
        total_earned: (creator.total_earned || 0) + payoutAmount,
      }).eq('id', collab.creator_id)
    }
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
