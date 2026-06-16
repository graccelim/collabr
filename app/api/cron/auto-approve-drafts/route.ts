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
    .eq('payment_status', 'funded')
    .lt('draft_auto_approve_at', new Date().toISOString())

  if (!collabs?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  const now = new Date().toISOString()
  for (const c of collabs) {
    const { data: approved, error } = await supabase.rpc('auto_approve_draft_atomic', {
      p_collab_id: c.id,
      p_now: now,
    })
    if (error) {
      console.error(`[CRON AUTO-APPROVE] Failed for collab ${c.id}: ${error.message}`)
      continue
    }
    if (approved !== true) continue

    const creatorUserId = (c.creator_profiles as any)?.user_id
    if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'draft_approved',
      title: 'Draft auto-approved, post live now!', body: 'Brand did not respond in 48h, so your draft was auto-approved.',
      payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:draft-auto-approved:creator` })

    const brandUserId = (c.brand_profiles as any)?.user_id
    if (brandUserId) await sendNotification({ userId: brandUserId, type: 'draft_auto_approved',
      title: 'Draft auto-approved', body: 'You did not review within 48h, so the draft was auto-approved.',
      payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:draft-auto-approved:brand` })
    processed++
  }

  return NextResponse.json({ processed })
}
