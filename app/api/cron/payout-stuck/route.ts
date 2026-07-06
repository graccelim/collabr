import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails, sendPayoutAdminEmail, link } from '@/lib/email'
import { retryCreatorPayout } from '@/lib/collab-funding'
import { captureTransferAndComplete } from '@/lib/payments'
import { formatSGD } from '@/lib/utils'

// Creator-never-connects fallback. A paid collab whose work is approved but
// whose creator never finished Stripe Connect sits in payment_status
// 'transfer_failed' (money captured + held, NOT transferred). We NEVER auto-lose
// or auto-release those funds. Instead, per stuck collab:
//   1. retry the payout (in case Connect is now ready) — idempotent
//   2. before the grace period → periodic "connect payouts" reminders
//   3. at the grace period → escalate ONCE to a manual support-review state:
//      flag payout_review_at, tell creator + brand, and email the support inbox
// Configurable via env (days): PAYOUT_REMINDER_DAYS, PAYOUT_GRACE_DAYS.
const REMINDER_DAYS = Number(process.env.PAYOUT_REMINDER_DAYS) || 2
const GRACE_DAYS = Number(process.env.PAYOUT_GRACE_DAYS) || 7

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const ageDays = (iso: string | null) => (iso ? (now - new Date(iso).getTime()) / 86_400_000 : 0)

  const { data: stuck } = await admin.from('collabs')
    .select('id, creator_id, agreed_rate, creator_payout, stripe_payment_intent_id, stripe_transfer_id, payment_status, captured_at, funded_at, payout_reminded_at, payout_review_at, campaigns(title), creator_profiles(user_id, users(email, display_name)), brand_profiles(user_id, company_name)')
    .eq('payment_status', 'transfer_failed')
  if (!stuck?.length) return NextResponse.json({ stuck: 0 })

  let released = 0, reminded = 0, escalated = 0
  for (const c of stuck) {
    // 1. The creator may have connected since we last looked — try to pay them.
    if (await retryCreatorPayout(admin, c as any)) { released++; continue }

    const creatorUserId = (c.creator_profiles as any)?.user_id
    const creatorEmail = (c.creator_profiles as any)?.users?.email
    const creatorName = (c.creator_profiles as any)?.users?.display_name || 'the creator'
    const brandUserId = (c.brand_profiles as any)?.user_id
    const amount = formatSGD(c.creator_payout)
    const stuckSince = (c.captured_at as string) || (c.funded_at as string) || null
    const stuckDays = ageDays(stuckSince)

    // 2. Escalate once, at the grace period, to manual support review. The
    // stamp is CAS-guarded and checked: if it didn't land (error or another
    // run claimed it), skip — otherwise the un-deduped admin email re-sends
    // every day.
    if (stuckDays >= GRACE_DAYS && !c.payout_review_at) {
      const { data: stamped, error: stampErr } = await admin.from('collabs')
        .update({ payout_review_at: nowIso }).eq('id', c.id).is('payout_review_at', null)
        .select('id')
      if (stampErr || !stamped?.length) continue
      if (creatorUserId) {
        await sendNotification({ userId: creatorUserId, type: 'payout_review',
          title: 'Your held payout is under review',
          body: `${amount} is waiting on your payout setup. Connect a payout account to release it, or contact support.`,
          payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:payout-review`, email: false })
        await sendProductEmail({ to: creatorEmail, userId: creatorUserId, ...productEmails.payoutUnderReview({ amount, collabId: c.id }) })
      }
      if (brandUserId) {
        await sendNotification({ userId: brandUserId, type: 'payout_review',
          title: 'A collab payment is held under review',
          body: `Your payment is captured and safe. We're following up with ${creatorName} to finish their payout setup.`,
          payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:payout-held-brand`, email: false })
        await sendProductEmail({ userId: brandUserId, ...productEmails.payoutHeldBrand({ creatorName, collabId: c.id }) })
      }
      await sendPayoutAdminEmail(`Payout stuck · ${(c.campaigns as any)?.title || 'collab'}`, {
        Event: `Held payout exceeded ${GRACE_DAYS}-day grace`,
        Creator: `${creatorName}${creatorEmail ? ` <${creatorEmail}>` : ''}`,
        Brand: (c.brand_profiles as any)?.company_name || '(brand)',
        Amount: amount,
        'Held since': stuckSince || '(unknown)',
        Reason: 'Creator has not connected a Stripe Connect payout account.',
        Collab: link(`/collabs/${c.id}`),
      }, c.id).catch(() => {})
      escalated++
      continue
    }

    // 3. Before the grace period: periodic reminder to connect payouts.
    // payout_reminded_at is null until the FIRST reminder — that must send
    // immediately (null means "never reminded", not "reminded just now").
    if (!c.payout_review_at && (!c.payout_reminded_at || ageDays(c.payout_reminded_at as string) >= REMINDER_DAYS)) {
      const { error: remindErr } = await admin.from('collabs')
        .update({ payout_reminded_at: nowIso }).eq('id', c.id)
      if (remindErr) { console.error('[CRON payout-stuck] remind stamp failed:', remindErr.message); continue }
      if (creatorUserId) {
        await sendNotification({ userId: creatorUserId, type: 'payout_pending',
          title: `Connect payouts to receive ${amount}`,
          body: 'Your payment is held safely. Connect a payout account and we release it automatically.',
          payload: { collab_id: c.id }, dedupeKey: `collab:${c.id}:payout-reminder:${nowIso.slice(0, 10)}`, email: false })
        await sendProductEmail({ to: creatorEmail, userId: creatorUserId, ...productEmails.payoutReminder({ amount, collabId: c.id, key: nowIso.slice(0, 10) }) })
      }
      reminded++
    }
  }

  // Backstop: a settler that crashed AFTER the Stripe transfer but BEFORE the DB
  // write leaves the collab at 'transfer_pending' with a stale lease. Only
  // auto-release-live otherwise recovers these — re-drive them here too. The
  // transfer idempotency key guarantees no double payout.
  const staleLease = new Date(now - 15 * 60 * 1000).toISOString()
  const { data: pending } = await admin.from('collabs')
    .select('id, creator_id, agreed_rate, creator_payout, stripe_payment_intent_id, stripe_transfer_id, payment_status')
    .eq('payment_status', 'transfer_pending')
    .lt('settlement_claimed_at', staleLease)
  let recovered = 0
  for (const c of pending || []) {
    const s = await captureTransferAndComplete(admin, c as any)
    if (s.ok && s.completed) recovered++
  }

  return NextResponse.json({ stuck: stuck.length, released, reminded, escalated, recovered })
}
