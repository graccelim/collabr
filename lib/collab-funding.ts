import type { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { isCampaignFilled } from '@/lib/collab-status'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Runs when a collab's escrow becomes secured (the Stripe `funded` webhook).
 *
 * This is the ONLY moment the creator learns they're confirmed — selection
 * before payment is never surfaced. If the campaign is now full (counting only
 * funded collabs), the remaining applicants get a definite answer here, not at
 * the moment of a merely-selected, unfunded collab.
 *
 * Idempotent: notifications use dedupe keys and the reject update is guarded to
 * pending/shortlisted, so repeat webhook deliveries are safe.
 */
export async function notifyCollabFunded(admin: Admin, collabId: string) {
  const { data: collab } = await admin.from('collabs')
    .select('id, application_id, campaign_id, creator_profiles(user_id, users(email)), campaigns(title, creators_needed)')
    .eq('id', collabId).maybeSingle()
  if (!collab) return

  const cp = collab.creator_profiles as { user_id?: string; users?: { email?: string } } | null
  const campaign = collab.campaigns as { title?: string; creators_needed?: number } | null
  const title = campaign?.title || 'a campaign'
  const appId = collab.application_id as string | null

  // 1. Confirm the creator — escrow is secured, they can start.
  if (cp?.user_id && appId) {
    await sendNotification({
      userId: cp.user_id,
      type: 'application_selected',
      title: `Confirmed for "${title}" · payment secured`,
      body: 'The brand funded escrow. You can start the collab now.',
      payload: { application_id: appId, campaign_id: collab.campaign_id, collab_id: collab.id },
      dedupeKey: `application:${appId}:selected`,
    })
    if (cp.users?.email) {
      await sendProductEmail({ to: cp.users.email, ...productEmails.applicationSelected({ campaignTitle: title, applicationId: appId, collabId: collab.id }) })
    }
  }

  // 2. If the campaign is now filled (by FUNDED collabs), decline leftovers.
  const { data: collabs } = await admin.from('collabs')
    .select('status, payment_status').eq('campaign_id', collab.campaign_id)
  if (!isCampaignFilled(campaign?.creators_needed, collabs || [])) return

  const { data: leftover } = await admin.from('applications')
    .select('id, creator_profiles(user_id, users(email))')
    .eq('campaign_id', collab.campaign_id)
    .in('status', ['pending', 'shortlisted'])
  if (!leftover || leftover.length === 0) return

  await admin.from('applications').update({ status: 'rejected' })
    .in('id', leftover.map(l => l.id)).in('status', ['pending', 'shortlisted'])
  for (const l of leftover) {
    const uid = (l.creator_profiles as any)?.user_id
    const email = (l.creator_profiles as any)?.users?.email
    if (uid) await sendNotification({
      userId: uid, type: 'application_rejected',
      title: `Application closed for "${title}"`,
      body: 'This campaign has been filled. Thanks for applying, new campaigns are posted regularly.',
      payload: { application_id: l.id },
      dedupeKey: `application:${l.id}:rejected`,
    })
    if (email) await sendProductEmail({ to: email, ...productEmails.applicationRejected({ campaignTitle: title, applicationId: l.id }) })
  }
}
