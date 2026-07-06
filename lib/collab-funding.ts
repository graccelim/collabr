import type { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { captureTransferAndComplete } from '@/lib/payments'
import { isCampaignFilled } from '@/lib/collab-status'
import { formatSGD } from '@/lib/utils'
import { stripe } from '@/lib/stripe'

type Admin = ReturnType<typeof createAdminClient>

type StuckCollab = {
  id: string
  creator_id: string
  agreed_rate: number
  creator_payout: number
  stripe_payment_intent_id?: string | null
  stripe_transfer_id?: string | null
  payment_status: string
  creator_profiles?: { user_id?: string; users?: { email?: string; display_name?: string } } | null
  brand_profiles?: { user_id?: string } | null
}

/**
 * Retry a single stuck (transfer_failed) collab's payout — used when a creator
 * finally connects their payout account. Idempotent: the underlying transfer
 * carries a per-collab idempotency key, so a duplicate call never double-pays.
 * On success it clears the support-review flag and notifies both sides.
 * Returns true only if the collab actually completed.
 */
export async function retryCreatorPayout(admin: Admin, collab: StuckCollab): Promise<boolean> {
  if (collab.payment_status !== 'transfer_failed') return false
  const settlement = await captureTransferAndComplete(admin, collab as never)
  if (!settlement.ok || !settlement.completed) return false

  // No longer stuck: lift the support-review escalation if it was set.
  await admin.from('collabs').update({ payout_review_at: null }).eq('id', collab.id)

  const amount = formatSGD(collab.creator_payout)
  const creatorUserId = collab.creator_profiles?.user_id
  const creatorEmail = collab.creator_profiles?.users?.email
  const creatorName = collab.creator_profiles?.users?.display_name || 'the creator'
  const brandUserId = collab.brand_profiles?.user_id
  if (creatorUserId) {
    await sendNotification({
      userId: creatorUserId, type: 'payment_released',
      title: `${amount} transferred`,
      body: 'Your payout account is connected, your held payment was released.',
      payload: { collab_id: collab.id }, dedupeKey: `collab:${collab.id}:payment-released`,
      email: false,
    })
    await sendProductEmail({ to: creatorEmail, userId: creatorUserId, ...productEmails.paymentReleased({ amount, collabId: collab.id }) })
  }
  if (brandUserId) {
    await sendProductEmail({ userId: brandUserId, ...productEmails.collabCompletedBrand({ creatorName, amount, collabId: collab.id }) })
  }
  return true
}

/**
 * Immediately retry every stuck payout for the creator behind a Stripe Connect
 * account that just updated (the `account.updated` webhook). Safe to call on
 * every delivery — non-stuck creators short-circuit, and each transfer is
 * idempotent. Returns how many collabs were released.
 */
export async function retryStuckPayoutsForAccount(admin: Admin, connectAccountId: string): Promise<number> {
  const { data: creator } = await admin.from('creator_profiles')
    .select('id').eq('stripe_connect_id', connectAccountId).maybeSingle()
  if (!creator) return 0
  const { data: stuck } = await admin.from('collabs')
    .select('id, creator_id, agreed_rate, creator_payout, stripe_payment_intent_id, stripe_transfer_id, payment_status, creator_profiles(user_id, users(email, display_name)), brand_profiles(user_id)')
    .eq('creator_id', creator.id).eq('payment_status', 'transfer_failed')
  if (!stuck?.length) return 0
  let released = 0
  for (const c of stuck) { if (await retryCreatorPayout(admin, c as unknown as StuckCollab)) released++ }
  return released
}

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
  brandUserId: string | null = null,
): Promise<{ ok: boolean; reason?: string }> {
  // Atomically claim the undo under a row lock (race-safe vs Stripe funding).
  const { data, error } = await admin.rpc('claim_unselect_atomic', {
    p_collab_id: collab.id,
    p_brand_user_id: brandUserId,
  }).single()
  if (error) return { ok: false, reason: 'error' }
  const result = (data as any)?.result as string

  if (result === 'forbidden') return { ok: false, reason: 'forbidden' }
  if (result === 'funded') return { ok: false, reason: 'not_unfunded' }
  if (result === 'not_found') return { ok: false, reason: 'not_found' }

  // Cancelled (or already cancelled): release the Stripe authorization hold if
  // one exists. Best-effort — the collab is already cancelled in the DB, and an
  // uncaptured hold expires on its own. We never capture, so money stays safe.
  const intentId = (data as any)?.intent_id as string | null
  if (result === 'cancelled' && intentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(intentId)
      if (intent.status !== 'canceled' && intent.status !== 'succeeded') {
        await stripe.paymentIntents.cancel(intentId, {}, { idempotencyKey: `collab:${collab.id}:cancel` })
      }
    } catch { /* hold will expire; collab already cancelled */ }
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
    .select('id, application_id, campaign_id, agreed_rate, creator_profiles(user_id, users(email)), campaigns(title, creators_needed)')
    .eq('id', collabId).maybeSingle()
  if (!collab) return

  const cp = collab.creator_profiles as { user_id?: string; users?: { email?: string } } | null
  const campaign = collab.campaigns as { title?: string; creators_needed?: number } | null
  const title = campaign?.title || 'a campaign'
  const appId = collab.application_id as string | null
  const isBarter = (collab.agreed_rate ?? 0) === 0

  // 1. Confirm the creator — they can start (escrow is secured, or barter accepted).
  if (cp?.user_id && appId) {
    await sendNotification({
      userId: cp.user_id,
      type: 'application_selected',
      title: isBarter ? `You're confirmed for "${title}"` : `Confirmed for "${title}" · payment secured`,
      body: isBarter
        ? 'The brand accepted you for this barter collab. You can start now.'
        : 'The brand secured the payment. You can start the collab now.',
      payload: { application_id: appId, campaign_id: collab.campaign_id, collab_id: collab.id },
      dedupeKey: `application:${appId}:selected`,
      email: false,
    })
    if (cp.users?.email) {
      const selectedEmail = isBarter ? productEmails.applicationSelectedBarter : productEmails.applicationSelected
      await sendProductEmail({ to: cp.users.email, ...selectedEmail({ campaignTitle: title, applicationId: appId, collabId: collab.id }) })
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

  // Notify only rows the update actually rejected — a failed write or a racing
  // selection must not send "application closed" to a still-live applicant.
  const { data: rejectedRows, error: rejectErr } = await admin.from('applications')
    .update({ status: 'rejected' })
    .in('id', leftover.map(l => l.id)).in('status', ['pending', 'shortlisted'])
    .select('id')
  if (rejectErr) {
    console.error('[COLLAB FUNDING] leftover reject failed:', rejectErr.message)
    return
  }
  const rejectedIds = new Set((rejectedRows || []).map(r => r.id))
  for (const l of leftover) {
    if (!rejectedIds.has(l.id)) continue
    const uid = (l.creator_profiles as any)?.user_id
    const email = (l.creator_profiles as any)?.users?.email
    if (uid) await sendNotification({
      userId: uid, type: 'application_rejected',
      title: `Application closed for "${title}"`,
      body: 'This campaign has been filled. Thanks for applying, new campaigns are posted regularly.',
      payload: { application_id: l.id },
      dedupeKey: `application:${l.id}:rejected`,
      email: false,
    })
    if (email) await sendProductEmail({ to: email, ...productEmails.applicationRejected({ campaignTitle: title, applicationId: l.id }) })
  }
}
