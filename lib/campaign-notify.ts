import type { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import {
  sendProductEmail, productEmails, sendEmailBatch, renderCampaignAlertEmail,
  unsubscribeUrl, link,
} from '@/lib/email'
import { normalizeNicheTags, nicheLabel } from '@/lib/niches'
import { SOCIAL_LABELS, type SocialPlatform } from '@/lib/onboarding'
import { formatSGD } from '@/lib/utils'

type Admin = ReturnType<typeof createAdminClient>

// Safety valve on the alert fan-out: one campaign never emails more than this
// many creators (5 Resend batch calls). Raise deliberately as the base grows.
export const CAMPAIGN_ALERT_MAX_RECIPIENTS = 500

export interface AlertableCampaign {
  id: string
  slug?: string | null
  title: string
  brief: string
  comp_type: string
  budget_min: number | null
  budget_max: number | null
  barter_detail: string | null
  deliverable_types: string[] | null
  niche_tags: string[] | null
  platforms: string[] | null
  min_followers: number | null
}

// "Campaign alert" fan-out: when a campaign goes live, every creator whose
// niche_tags overlap the campaign's (and who hasn't opted out via
// campaign_alerts) gets an in-app notification + a rich alert email, in a
// handful of batched Resend calls. Untargeted campaigns (no niche tags) alert
// no one - a blast to the entire creator base is never the default.
// Best-effort: failures are logged and never block campaign creation.
export async function notifyNewCampaign(admin: Admin, campaign: AlertableCampaign, brandName: string): Promise<number> {
  try {
    const niches = normalizeNicheTags(campaign.niche_tags || [])
    if (niches.length === 0) return 0

    const { data: creators, error } = await admin.from('creator_profiles')
      .select('user_id, users(email)')
      .overlaps('niche_tags', niches)
      .eq('campaign_alerts', true)
      .limit(CAMPAIGN_ALERT_MAX_RECIPIENTS)
    if (error) {
      console.error('[CAMPAIGN ALERT] creator query failed:', error.message)
      return 0
    }
    const recipients = ((creators || []) as { user_id?: string; users?: { email?: string } | null }[])
      .map(c => ({ userId: c.user_id, email: c.users?.email }))
      .filter((r): r is { userId: string; email: string } => Boolean(r.userId && r.email))
    if (recipients.length === 0) return 0

    const href = `/jobs/${campaign.slug || campaign.id}`

    // In-app notifications, one bulk insert. A fresh campaign id means no
    // pre-existing rows, so a plain insert is safe; on the off chance of a
    // conflict the emails below still dedupe individually via email_log.
    const { error: notifErr } = await admin.from('notifications').insert(recipients.map(r => ({
      user_id: r.userId,
      type: 'campaign_new',
      title: `New campaign in your niche: “${campaign.title}”`,
      body: `${brandName} is looking for ${niches.map(nicheLabel).join(', ')} creators. Early applications get noticed first.`,
      payload: { campaign_id: campaign.id, href },
      dedupe_key: `campaign:${campaign.id}:alert`,
    })))
    if (notifErr && notifErr.code !== '23505') {
      console.error('[CAMPAIGN ALERT] notifications insert failed:', notifErr.message)
    }

    // Claim email dedupe keys in bulk; only the rows actually inserted get an
    // email, so a double-invocation can never double-send.
    const { data: claimed, error: claimErr } = await admin.from('email_log')
      .upsert(recipients.map(r => ({
        dedupe_key: `email:campaign:${campaign.id}:alert:${r.userId}`,
        recipient: r.email,
        email_type: 'campaign_alert',
      })), { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select('dedupe_key')
    if (claimErr) {
      console.error('[CAMPAIGN ALERT] dedupe claim failed, aborting fan-out:', claimErr.message)
      return 0
    }
    const claimedKeys = new Set((claimed || []).map((c: { dedupe_key: string }) => c.dedupe_key))
    const toSend = recipients.filter(r => claimedKeys.has(`email:campaign:${campaign.id}:alert:${r.userId}`))

    // Compensation line mirrors the public jobs page (budgets are cents).
    const isPaid = campaign.comp_type !== 'barter'
    const compValue = !isPaid
      ? 'Barter (a product or service exchange)'
      : campaign.budget_min && campaign.budget_max
        ? `${formatSGD(campaign.budget_min)} to ${formatSGD(campaign.budget_max)} per creator`
        : campaign.budget_min || campaign.budget_max
          ? `${formatSGD((campaign.budget_min || campaign.budget_max)!)} per creator`
          : 'Paid'

    await sendEmailBatch(toSend.map(r => {
      const unsub = unsubscribeUrl(r.userId)
      return {
        to: r.email,
        subject: `[Campaign alert] ${campaign.title}`,
        html: renderCampaignAlertEmail({
          campaignTitle: campaign.title,
          brandName,
          brief: campaign.brief || '',
          compValue,
          barterDetail: campaign.comp_type !== 'paid' ? campaign.barter_detail : null,
          deliverables: campaign.deliverable_types || [],
          platforms: (campaign.platforms || []).map(p => ({ slug: p, label: SOCIAL_LABELS[p as SocialPlatform] ?? p })),
          nicheLabels: niches.map(nicheLabel),
          minFollowers: campaign.min_followers || 0,
          campaignUrl: link(href),
          unsubscribeUrl: unsub,
        }),
        headers: {
          'List-Unsubscribe': `<${unsub}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }
    }))
    return toSend.length
  } catch (e) {
    console.error('[CAMPAIGN ALERT] fan-out failed:', (e as Error)?.message)
    return 0
  }
}

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
