import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'
import { formatSGD } from '@/lib/utils'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id, users(email)), brand_profiles(user_id)')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  if (brandUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (collab.status !== 'live_submitted') return NextResponse.json({ error: 'No live post to confirm' }, { status: 400 })

  // Update live post and collab
  await supabase.from('live_posts').update({ confirmed_at: new Date().toISOString() })
    .eq('collab_id', params.id).is('confirmed_at', null)
  await supabase.from('collabs').update({
    status: 'completed', live_auto_release_at: null
  }).eq('id', params.id)

  // Update creator stats
  const { data: creator } = await supabase.from('creator_profiles')
    .select('collabs_completed, total_earned').eq('id', collab.creator_id).single()
  if (creator) {
    await supabase.from('creator_profiles').update({
      collabs_completed: (creator.collabs_completed || 0) + 1,
      total_earned: (creator.total_earned || 0) + collab.creator_payout,
    }).eq('id', collab.creator_id)
  }

  // TODO: Call Stripe capture() here when Stripe is configured
  // For now log it
  console.log(`[PAYMENT] Release ${formatSGD(collab.creator_payout)} for collab ${params.id}`)

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const creatorEmail = (collab.creator_profiles as any)?.users?.email
  if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'payment_released',
    title: `${formatSGD(collab.creator_payout)} is on the way`, payload: { collab_id: params.id } })
  if (creatorEmail) await emails.paymentReleased(creatorEmail, formatSGD(collab.creator_payout))

  return NextResponse.json({ success: true })
}
