import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'
import { formatSGD } from '@/lib/utils'
import { captureTransferAndComplete } from '@/lib/payments'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: collabs } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id, users(email)), brand_profiles(user_id)')
    .eq('status', 'live_submitted')
    .in('payment_status', ['funded', 'capture_failed', 'captured', 'transfer_pending', 'transfer_failed', 'paid', 'manual_exception'])
    .lt('live_auto_release_at', new Date().toISOString())

  if (!collabs?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  let failed = 0
  for (const c of collabs) {
    const settlement = await captureTransferAndComplete(supabase, c)
    if (!settlement.ok) {
      console.error(`[CRON AUTO-RELEASE] Settlement failed for collab ${c.id}: ${settlement.error}`)
      failed++
      continue
    }

    await supabase.from('live_posts').update({ confirmed_at: new Date().toISOString() })
      .eq('collab_id', c.id).is('confirmed_at', null)

    const creatorUserId = (c.creator_profiles as any)?.user_id
    const creatorEmail = (c.creator_profiles as any)?.users?.email
    if (settlement.completed && creatorUserId) await sendNotification({ userId: creatorUserId, type: 'payment_released',
      title: `${formatSGD(c.creator_payout)} transferred`, body: 'Automatic settlement succeeded after 72h.',
      payload: { collab_id: c.id } })
    if (settlement.completed && creatorEmail) await emails.paymentReleased(creatorEmail, formatSGD(c.creator_payout))
    processed++
  }

  return NextResponse.json({ processed, failed })
}
