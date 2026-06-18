import type { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { cancelOrRefundPayment } from '@/lib/payments'
import { isCampaignFilled, canReleaseUnfunded } from '@/lib/collab-status'

type Admin = ReturnType<typeof createAdminClient>

type ReleasableCollab = {
  id: string
  application_id: string | null
  status: string
  payment_status: string
  stripe_payment_intent_id?: string | null
  stripe_transfer_id?: string | null
}

/**
 * Unwind a hidden, unfunded collab and return its applicant to the pool. Shared
 * by brand "Undo selection" and the funding-deadline cron.
 *
 * - releases/cancels any uncaptured PaymentIntent (no-op when never funded)
 * - sets the collab to 'cancelled' (frees capacity — the unique index + capacity
 *   count both ignore cancelled, so the applicant is re-selectable)
 * - reverts the application to 'pending'
 * - NO creator notification — to the creator the application stays "Applied"
 *
 * Idempotent: guards on briefed/unfunded, and the writes are CAS-guarded so a
 * second call (or an overlapping cron) is a no-op.
 */
export async function releaseUnfundedCollab(
  admin: Admin,
  collab: ReleasableCollab,
): Promise<{ ok: boolean; reason?: string }> {
  if (!canReleaseUnfunded(collab)) return { ok: false, reason: 'not_unfunded' }

  // Cancel the authorization hold if one exists (unfunded → no intent → no-op).
  const settlement = await cancelOrRefundPayment(admin, collab as never)
  if (!settlement.ok) return { ok: false, reason: 'payment' }

  // Cancel the collab (guard: still briefed, payment now cancelled/unfunded).
  await admin.from('collabs').update({ status: 'cancelled' })
    .eq('id', collab.id).eq('status', 'briefed')

  // Return the applicant to the pool (guard: only flip a still-selected app).
  if (collab.application_id) {
    await admin.from('applications').update({ status: 'pending' })
      .eq('id', collab.application_id).eq('status', 'selected')
  }
  return { ok: true }
}

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
