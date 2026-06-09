import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'
import { formatSGD } from '@/lib/utils'
import { stripe } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: collabs } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id, users(email)), brand_profiles(user_id)')
    .eq('status', 'live_submitted')
    .lt('live_auto_release_at', new Date().toISOString())

  if (!collabs?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const c of collabs) {
    // Capture escrow funds first — intent stays idempotent on retry if DB write fails after
    if (c.stripe_payment_intent_id) {
      try {
        const intent = await stripe.paymentIntents.retrieve(c.stripe_payment_intent_id)
        if (intent.status === 'requires_capture') {
          await stripe.paymentIntents.capture(c.stripe_payment_intent_id)
        }
      } catch (e) {
        // Non-fatal: complete the collab regardless so creator isn't permanently blocked
        console.error(`[CRON AUTO-RELEASE] Stripe capture failed for collab ${c.id}:`, e)
      }
    }

    await supabase.from('live_posts').update({ confirmed_at: new Date().toISOString() })
      .eq('collab_id', c.id).is('confirmed_at', null)
    await supabase.from('collabs').update({ status: 'completed', live_auto_release_at: null }).eq('id', c.id)

    const creator = await supabase.from('creator_profiles')
      .select('collabs_completed, total_earned').eq('id', c.creator_id).single()
    if (creator.data) {
      await supabase.from('creator_profiles').update({
        collabs_completed: (creator.data.collabs_completed || 0) + 1,
        total_earned: (creator.data.total_earned || 0) + c.creator_payout,
      }).eq('id', c.creator_id)
    }

    const creatorUserId = (c.creator_profiles as any)?.user_id
    const creatorEmail = (c.creator_profiles as any)?.users?.email
    if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'payment_released',
      title: `${formatSGD(c.creator_payout)} auto-released`, body: 'Brand did not confirm within 72h.',
      payload: { collab_id: c.id } })
    if (creatorEmail) await emails.paymentReleased(creatorEmail, formatSGD(c.creator_payout))
    processed++
  }

  return NextResponse.json({ processed })
}
