import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: collabs } = await supabase.from('collabs')
    .select('id, creator_id, brand_id, creator_profiles(user_id), brand_profiles(user_id)')
    .eq('status', 'draft_submitted')
    .lt('draft_auto_approve_at', new Date().toISOString())

  if (!collabs?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const c of collabs) {
    await supabase.from('collabs').update({ status: 'draft_approved', draft_auto_approve_at: null }).eq('id', c.id)
    await supabase.from('submissions').update({ decision: 'approved', decided_at: new Date().toISOString() })
      .eq('collab_id', c.id).eq('decision', 'pending')

    const creatorUserId = (c.creator_profiles as any)?.user_id
    if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'draft_approved',
      title: 'Draft auto-approved — post live now!', body: 'Brand did not respond in 48h, so your draft was auto-approved.',
      payload: { collab_id: c.id } })

    const brandUserId = (c.brand_profiles as any)?.user_id
    if (brandUserId) await sendNotification({ userId: brandUserId, type: 'draft_auto_approved',
      title: 'Draft auto-approved', body: 'You did not review within 48h, so the draft was auto-approved.',
      payload: { collab_id: c.id } })
    processed++
  }

  return NextResponse.json({ processed })
}
