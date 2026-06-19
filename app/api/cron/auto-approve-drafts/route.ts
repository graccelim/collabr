import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

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
    if (creatorUserId) {
      await sendNotification({ userId: creatorUserId, type: 'draft_approved',
        title: 'Draft auto-approved, post live now!', body: 'Brand did not respond in 48h, so your draft was auto-approved.',
        payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:draft-auto-approved:creator` })
      // Email matching the in-app event (deduped via email_log).
      await sendProductEmail({ userId: creatorUserId, ...productEmails.draftAutoApproved({ collabId: c.id }) })
    }

    const brandUserId = (c.brand_profiles as any)?.user_id
    if (brandUserId) {
      await sendNotification({ userId: brandUserId, type: 'draft_auto_approved',
        title: 'A draft was automatically approved',
        body: 'A creator’s draft was automatically approved because the review window ended. The collaboration can now continue to the live-post stage.',
        payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:draft-auto-approved:brand` })
      await sendProductEmail({ userId: brandUserId, ...productEmails.draftAutoApprovedBrand({ collabId: c.id }) })
    }
    processed++
  }

  return NextResponse.json({ processed })
}
