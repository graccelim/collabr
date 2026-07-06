import type { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

type Admin = ReturnType<typeof createAdminClient>

// Fields whose change is worth telling applicants/creators about.
export const CONTENT_FIELDS = ['title', 'brief', 'deliverable_types', 'comp_type', 'budget_min',
  'budget_max', 'barter_detail', 'niche_tags', 'platforms', 'min_followers', 'creators_needed', 'deadline']

// Fan out "the campaign you applied to changed" notifications. Selected creators
// (with an active collab) are nudged into the collab chat; plain applicants get a
// heads-up. Best-effort - never blocks the edit.
export async function notifyCampaignChange(admin: Admin, campaignId: string, title: string) {
  const [{ data: apps }, { data: collabs }, { data: camp }] = await Promise.all([
    admin.from('applications')
      .select('status, creator_profiles(id, user_id)')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'shortlisted', 'selected']),
    admin.from('collabs')
      .select('id, creator_id, status').eq('campaign_id', campaignId)
      .not('status', 'in', '(cancelled,completed)'),
    admin.from('campaigns').select('slug').eq('id', campaignId).maybeSingle(),
  ])
  // Prefer the SEO slug for the public campaign link; UUID stays a valid fallback.
  const campaignHref = `/jobs/${(camp as { slug?: string | null } | null)?.slug || campaignId}`
  const collabByCreator = new Map((collabs || []).map((c: { creator_id: string; id: string }) => [c.creator_id, c.id]))
  // Deduped per (user, campaign, day): a brand polishing a brief over several
  // saves must not fan out one notification + email PER SAVE to every applicant.
  const day = new Date().toISOString().slice(0, 10)
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
        dedupeKey: `campaign:${campaignId}:updated:${day}`,
      })
    } else {
      await sendNotification({
        userId: cp.user_id,
        type: 'campaign_updated',
        title: `“${title}” was updated`,
        body: 'A campaign you applied to changed its brief or terms.',
        payload: { campaign_id: campaignId, href: campaignHref },
        dedupeKey: `campaign:${campaignId}:updated:${day}`,
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
  // Notify only the rows the update actually rejected (mirrors the cron): a
  // failed write or a concurrent selection must not produce a rejection email.
  const { data: rejectedRows, error: rejectErr } = await admin.from('applications')
    .update({ status: 'rejected' })
    .in('id', open.map((a: { id: string }) => a.id))
    .in('status', ['pending', 'shortlisted'])
    .select('id')
  if (rejectErr) {
    console.error('[CAMPAIGN CLOSE] reject update failed:', rejectErr.message)
    return
  }
  const rejectedIds = new Set((rejectedRows || []).map(r => r.id))
  for (const a of open) {
    if (!rejectedIds.has(a.id)) continue
    const cp = a.creator_profiles as { user_id?: string; users?: { email?: string } } | null
    if (cp?.user_id) {
      await sendNotification({
        userId: cp.user_id,
        type: 'application_rejected',
        title: `Application closed for "${title}"`,
        body: 'This campaign is no longer accepting applicants. Thanks for applying, new campaigns are posted regularly.',
        payload: { application_id: a.id },
        dedupeKey: `application:${a.id}:rejected`,
        email: false,
      })
    }
    if (cp?.users?.email) {
      await sendProductEmail({ to: cp.users.email, ...productEmails.applicationRejected({ campaignTitle: title, applicationId: a.id }) })
    }
  }
}
