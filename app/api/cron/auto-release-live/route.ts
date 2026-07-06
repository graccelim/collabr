import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { formatSGD } from '@/lib/utils'
import { captureTransferAndComplete, completeBarterCollab } from '@/lib/payments'

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: collabs } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id, users(display_name, email)), brand_profiles(user_id)')
    .in('status', ['live_submitted', 'live_confirmed'])
    .in('payment_status', ['funded', 'capture_failed', 'captured', 'transfer_pending', 'transfer_failed', 'paid', 'manual_exception'])
    .or(`status.eq.live_confirmed,live_auto_release_at.lt.${new Date().toISOString()}`)

  if (!collabs?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  let failed = 0
  for (const c of collabs) {
    const { data: claimed, error: claimError } = await supabase.rpc('claim_live_settlement', {
      p_collab_id: c.id,
      p_require_expired: true,
      p_now: new Date().toISOString(),
    })
    if (claimError || claimed !== true) {
      if (claimError) console.error(`[CRON AUTO-RELEASE] Claim failed for collab ${c.id}: ${claimError.message}`)
      continue
    }

    const isBarter = (c.agreed_rate ?? 0) === 0
    const settlement = isBarter
      ? await completeBarterCollab(supabase, c.id)
      : await captureTransferAndComplete(supabase, c)
    if (!settlement.ok) {
      console.error(`[CRON AUTO-RELEASE] Settlement failed for collab ${c.id}: ${settlement.error}`)
      failed++
      continue
    }

    await supabase.from('live_posts').update({ confirmed_at: new Date().toISOString() })
      .eq('collab_id', c.id).is('confirmed_at', null)

    const creatorUserId = (c.creator_profiles as any)?.user_id
    const creatorEmail = (c.creator_profiles as any)?.users?.email
    const creatorName = (c.creator_profiles as any)?.users?.display_name || 'the creator'
    const brandUserId = (c.brand_profiles as any)?.user_id
    if (settlement.completed && isBarter) {
      if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'collab_completed',
        title: 'Your barter collab is complete', body: 'Auto-completed after 72h. Leave a review to build trust.',
        payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:completed` })
      // The brand must hear it completed too (reviews just opened for them).
      if (brandUserId) await sendNotification({ userId: brandUserId, type: 'collab_completed',
        title: 'Your barter collab is complete',
        body: `Your collaboration with ${creatorName} auto-completed after the 72h window. Leave a review to build trust.`,
        payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:completed-brand` })
    } else if (settlement.completed) {
      const amount = formatSGD(c.creator_payout)
      if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'payment_released',
        title: `${amount} transferred`, body: 'Automatic settlement succeeded after 72h.',
        payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:payment-released`, email: false })
      await sendProductEmail({ to: creatorEmail, userId: creatorUserId, ...productEmails.paymentReleased({ amount, collabId: c.id }) })
      await sendProductEmail({ userId: brandUserId, ...productEmails.collabCompletedBrand({ creatorName, amount, collabId: c.id }) })
    }
    processed++
  }

  return NextResponse.json({ processed, failed })
}
