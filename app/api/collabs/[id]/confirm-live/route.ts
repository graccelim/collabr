import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'
import { formatSGD } from '@/lib/utils'
import { captureTransferAndComplete } from '@/lib/payments'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(id, user_id, users(email)), brand_profiles(user_id)')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  if (brandUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (collab.status !== 'live_submitted') return NextResponse.json({ error: 'No live post to confirm' }, { status: 400 })
  const admin = createAdminClient()

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
  if (settlement.completed && creatorUserId) {
    await sendNotification({
      userId: creatorUserId,
      type: 'payment_released',
      title: `${formatSGD(collab.creator_payout)} is on the way`,
      payload: { collab_id: params.id },
    })
  }
  if (settlement.completed && creatorEmail) await emails.paymentReleased(creatorEmail, formatSGD(collab.creator_payout))

  return NextResponse.json({ success: true, already_completed: !settlement.completed })
}
