import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

// Review-window reminders. Runs every 6h so it can catch the 24h / 12h / 6h
// thresholds for live review. Each threshold fires once (dedupe keys per
// threshold), in-app + email.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  // ── Drafts auto-approving within 6h → nudge the brand to review ──
  const { data: expiringDrafts } = await supabase.from('collabs')
    .select('id, draft_auto_approve_at, brand_profiles(user_id), campaigns(title)')
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
        dedupeKey: `collab:${c.id}:draft-expiring:6h`,
      })
      notifiedDrafts++
    }
  }

  // ── Live posts approaching auto-release → remind the brand at 24h / 12h / 6h ──
  const { data: liveCollabs } = await supabase.from('collabs')
    .select('id, live_auto_release_at, brand_profiles(user_id, users(email)), creator_profiles(users(display_name))')
    .eq('status', 'live_submitted')
    .eq('payment_status', 'funded')
    .gt('live_auto_release_at', now.toISOString())
    .lt('live_auto_release_at', in24h)

  let notifiedLive = 0
  for (const c of liveCollabs || []) {
    const deadline = c.live_auto_release_at ? new Date(c.live_auto_release_at).getTime() : 0
    const hoursLeft = Math.max(0, Math.round((deadline - now.getTime()) / (60 * 60 * 1000)))
    // The most urgent threshold that has been crossed this run.
    const threshold = hoursLeft <= 6 ? 6 : hoursLeft <= 12 ? 12 : 24
    const brandUserId = (c.brand_profiles as any)?.user_id
    const brandEmail = (c.brand_profiles as any)?.users?.email
    const creatorName = (c.creator_profiles as any)?.users?.display_name || 'Your creator'
    if (!brandUserId) continue

    await sendNotification({
      userId: brandUserId,
      type: 'live_expiring',
      title: `~${threshold}h left to review ${creatorName}'s live post`,
      body: 'Confirm the post or raise an issue. Otherwise payment releases automatically when the window expires.',
      payload: { collab_id: c.id },
      dedupeKey: `collab:${c.id}:live-remind:${threshold}h`,
    })
    if (brandEmail) {
      await sendProductEmail({ to: brandEmail, ...productEmails.liveReviewReminder({ creatorName, collabId: c.id, hoursLeft: threshold }) })
    }
    notifiedLive++
  }

  return NextResponse.json({ notified_drafts: notifiedDrafts, notified_live: notifiedLive })
}
