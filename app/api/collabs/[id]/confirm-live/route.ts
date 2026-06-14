import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { formatSGD } from '@/lib/utils'
import { captureTransferAndComplete } from '@/lib/payments'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(id, user_id, users(display_name, email)), brand_profiles(user_id)')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  if (brandUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (collab.status === 'completed' && ['paid', 'manual_exception'].includes(collab.payment_status)) {
    return NextResponse.json({ success: true, already_completed: true })
  }
  const admin = createAdminClient()

  const { data: claimed, error: claimError } = await admin.rpc('claim_live_settlement', {
    p_collab_id: params.id,
    p_require_expired: false,
    p_now: new Date().toISOString(),
  })
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 409 })
  if (claimed !== true) return NextResponse.json({ error: 'No live post is eligible for confirmation' }, { status: 409 })

  const settlement = await captureTransferAndComplete(admin, collab)
  if (!settlement.ok) {
    return NextResponse.json({
      error: settlement.paymentStatus === 'transfer_failed'
        ? 'Payment captured, but creator payout failed. Support must retry the payout.'
        : 'Payment capture failed. The collab was not completed.',
    }, { status: 502 })
  }

  // Payment and payout succeeded; record live confirmation.
  await admin.from('live_posts')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('collab_id', params.id).is('confirmed_at', null)

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const creatorEmail = (collab.creator_profiles as any)?.users?.email
  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'the creator'
  const amount = formatSGD(collab.creator_payout)
  if (settlement.completed && creatorUserId) {
    await sendNotification({
      userId: creatorUserId,
      type: 'payment_released',
      title: `${amount} is on the way`,
      payload: { collab_id: params.id },
      dedupeKey: `collab:${params.id}:payment-released`,
    })
  }
  if (settlement.completed) {
    // Creator: payment released. Brand: collab completed.
    await sendProductEmail({ to: creatorEmail, userId: creatorUserId, ...productEmails.paymentReleased({ amount, collabId: params.id }) })
    await sendProductEmail({ userId: brandUserId, ...productEmails.collabCompletedBrand({ creatorName, amount, collabId: params.id }) })
  }

  return NextResponse.json({ success: true, already_completed: !settlement.completed })
}
