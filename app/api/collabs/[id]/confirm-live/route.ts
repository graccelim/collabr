import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'
import { formatSGD } from '@/lib/utils'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(id, user_id, stripe_connect_id, users(email)), brand_profiles(user_id)')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  if (brandUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (collab.status !== 'live_submitted') return NextResponse.json({ error: 'No live post to confirm' }, { status: 400 })

  // Capture the held funds from the escrow PaymentIntent
  if (collab.stripe_payment_intent_id) {
    try {
      const intent = await stripe.paymentIntents.retrieve(collab.stripe_payment_intent_id)
      if (intent.status === 'requires_capture') {
        await stripe.paymentIntents.capture(collab.stripe_payment_intent_id)
      }
    } catch (e) {
      console.error('[STRIPE CAPTURE ERROR]', e)
      return NextResponse.json({ error: 'Payment capture failed' }, { status: 500 })
    }
  } else {
    console.warn(`[PAYMENT] No payment intent for collab ${params.id} — skipping capture`)
  }

  // Confirm live post and mark collab completed
  await supabase.from('live_posts')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('collab_id', params.id).is('confirmed_at', null)
  await supabase.from('collabs')
    .update({ status: 'completed', live_auto_release_at: null })
    .eq('id', params.id)

  // Update creator lifetime stats
  const { data: creator } = await supabase.from('creator_profiles')
    .select('collabs_completed, total_earned').eq('id', collab.creator_id).single()
  if (creator) {
    await supabase.from('creator_profiles').update({
      collabs_completed: (creator.collabs_completed || 0) + 1,
      total_earned: (creator.total_earned || 0) + collab.creator_payout,
    }).eq('id', collab.creator_id)
  }

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const creatorEmail = (collab.creator_profiles as any)?.users?.email
  if (creatorUserId) {
    await sendNotification({
      userId: creatorUserId,
      type: 'payment_released',
      title: `${formatSGD(collab.creator_payout)} is on the way`,
      payload: { collab_id: params.id },
    })
  }
  if (creatorEmail) await emails.paymentReleased(creatorEmail, formatSGD(collab.creator_payout))

  return NextResponse.json({ success: true })
}
