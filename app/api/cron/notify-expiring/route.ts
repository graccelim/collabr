import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
  const in12h = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()

  // Drafts expiring within 6h - notify brand
  const { data: expiringDrafts } = await supabase.from('collabs')
    .select('id, brand_id, draft_auto_approve_at, brand_profiles(user_id), campaigns(title)')
    .eq('status', 'draft_submitted')
    .eq('payment_status', 'funded')
    .gt('draft_auto_approve_at', now.toISOString())
    .lt('draft_auto_approve_at', in6h)

  let notifiedDrafts = 0
  for (const c of expiringDrafts || []) {
    const brandUserId = (c.brand_profiles as any)?.user_id
    if (brandUserId) {
      await sendNotification({
        userId: brandUserId,
        type: 'draft_expiring',
        title: `Review pending: "${(c.campaigns as any)?.title}" auto-approves in <6h`,
        payload: { collab_id: c.id },
      })
      notifiedDrafts++
    }
  }

  // Live posts expiring within 12h - notify brand
  const { data: expiringLive } = await supabase.from('collabs')
    .select('id, live_auto_release_at, brand_profiles(user_id), campaigns(title), creator_profiles(users(display_name))')
    .eq('status', 'live_submitted')
    .eq('payment_status', 'funded')
    .gt('live_auto_release_at', now.toISOString())
    .lt('live_auto_release_at', in12h)

  let notifiedLive = 0
  for (const c of expiringLive || []) {
    const brandUserId = (c.brand_profiles as any)?.user_id
    const creatorName = (c.creator_profiles as any)?.users?.display_name || 'Creator'
    if (brandUserId) {
      await sendNotification({
        userId: brandUserId,
        type: 'live_expiring',
        title: `Automatic payment settlement starts in <12h for ${creatorName}`,
        body: 'Confirm the live post now to control the release.',
        payload: { collab_id: c.id },
      })
      notifiedLive++
    }
  }

  return NextResponse.json({ notified_drafts: notifiedDrafts, notified_live: notifiedLive })
}
