import type { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

type Admin = ReturnType<typeof createAdminClient>

// Fields whose change is worth telling applicants/creators about.
export const CONTENT_FIELDS = ['title', 'brief', 'deliverable_types', 'comp_type', 'budget_min',
  'budget_max', 'barter_detail', 'niche_tags', 'min_followers', 'creators_needed', 'deadline']

// Fan out "the campaign you applied to changed" notifications. Selected creators
// (with an active collab) are nudged into the collab chat; plain applicants get a
// heads-up. Best-effort - never blocks the edit.
export async function notifyCampaignChange(admin: Admin, campaignId: string, title: string) {
  const [{ data: apps }, { data: collabs }] = await Promise.all([
    admin.from('applications')
      .select('status, creator_profiles(id, user_id)')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'shortlisted', 'selected']),
    admin.from('collabs')
      .select('id, creator_id, status').eq('campaign_id', campaignId)
      .not('status', 'in', '(cancelled,completed)'),
  ])
  const collabByCreator = new Map((collabs || []).map((c: { creator_id: string; id: string }) => [c.creator_id, c.id]))
  for (const a of apps || []) {
    const cp = a.creator_profiles as { id?: string; user_id?: string } | null
    if (!cp?.user_id) continue
    const collabId = cp.id ? collabByCreator.get(cp.id) : undefined
    if (a.status === 'selected' && collabId) {
      await sendNotification({
        userId: cp.user_id,
        type: 'campaign_updated',
        title: `“${title}” was updated`,
        body: 'The brand changed the brief or terms. Open your collab chat to discuss before you keep working.',
        payload: { campaign_id: campaignId, collab_id: collabId, href: `/collabs/${collabId}` },
      })
    } else {
      await sendNotification({
        userId: cp.user_id,
        type: 'campaign_updated',
        title: `“${title}” was updated`,
        body: 'A campaign you applied to changed its brief or terms.',
        payload: { campaign_id: campaignId, href: `/jobs/${campaignId}` },
      })
    }
  }
}

// On a manual close, give open applicants (pending/shortlisted) an instant,
// definite answer instead of waiting for the expire-applications cron. Mirrors
// the cron exactly (same status flip, notification + email, dedupe key) so the
// two never double up. Selected creators are untouched - their collabs continue.
export async function notifyCampaignClosed(admin: Admin, campaignId: string, title: string) {
  const { data: open } = await admin.from('applications')
    .select('id, creator_profiles(user_id, users(email))')
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'shortlisted'])
  if (!open || open.length === 0) return
  await admin.from('applications')
    .update({ status: 'rejected' })
    .in('id', open.map((a: { id: string }) => a.id))
    .in('status', ['pending', 'shortlisted'])
  for (const a of open) {
    const cp = a.creator_profiles as { user_id?: string; users?: { email?: string } } | null
    if (cp?.user_id) {
      await sendNotification({
        userId: cp.user_id,
        type: 'application_rejected',
        title: `Application closed for "${title}"`,
        body: 'This campaign is no longer accepting applicants. Thanks for applying, new campaigns are posted regularly.',
        payload: { application_id: a.id },
        dedupeKey: `application:${a.id}:rejected`,
      })
    }
    if (cp?.users?.email) {
      await sendProductEmail({ to: cp.users.email, ...productEmails.applicationRejected({ campaignTitle: title, applicationId: a.id }) })
    }
  }
}
