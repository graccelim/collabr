import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { cancelOrRefundPayment } from '@/lib/payments'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id), brand_profiles(user_id)')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const creatorUserId = (collab.creator_profiles as any)?.user_id
  if (brandUserId !== user.id && creatorUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cancellableStatuses = ['briefed', 'draft_submitted', 'in_revision']
  if (!cancellableStatuses.includes(collab.status)) {
    return NextResponse.json({ error: 'Cannot cancel at this stage' }, { status: 400 })
  }

  const admin = createAdminClient()
  const settlement = await cancelOrRefundPayment(admin, collab)
  if (!settlement.ok) {
    return NextResponse.json({
      error: 'Payment cancellation/refund failed. The collab was not cancelled.',
    }, { status: 502 })
  }

  await admin.from('collabs').update({ status: 'cancelled' }).eq('id', params.id)

  const otherUserId = user.id === brandUserId ? creatorUserId : brandUserId
  if (otherUserId) {
    await sendNotification({ userId: otherUserId, type: 'collab_cancelled',
      title: 'A collab has been cancelled', payload: { collab_id: params.id } })
  }

  return NextResponse.json({ success: true })
}
