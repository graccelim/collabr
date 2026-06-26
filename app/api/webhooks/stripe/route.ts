import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyCollabFunded, retryStuckPayoutsForAccount } from '@/lib/collab-funding'
import { stripe, BOOST_MAX_HORIZON_DAYS, brandPlusPriceIds } from '@/lib/stripe'
import { setBrandStripeCustomer, getBrandIdByStripeCustomer } from '@/lib/brand-billing'
import { paymentStatusFromIntent } from '@/lib/payments'
import { sendPayoutAdminEmail, link } from '@/lib/email'
import Stripe from 'stripe'

async function ensureWrite(result: PromiseLike<{ error: any }>) {
  const { error } = await result
  if (error) throw error
}

// ── Phase 10: subscription sync ───────────────────────────────────────────────
// Maps Stripe subscription state onto brand_profiles. Cancellation (including
// cancel_at_period_end) keeps plan='pro' with status='cancelled' - resolvePlan
// grants access until subscription_current_period_end, then the brand reverts
// to Free with all saved data retained.
async function applySubscriptionToBrand(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const brandId = subscription.metadata?.brand_id
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null

  // Map the subscribed price to the brand tier (Pro vs Plus).
  const priceId = subscription.items?.data?.[0]?.price?.id
  const plusIds = brandPlusPriceIds()
  const paidTier: 'pro' | 'plus' =
    priceId && (priceId === plusIds.monthly || priceId === plusIds.annual) ? 'plus' : 'pro'

  let status: 'active' | 'cancelled' | 'past_due'
  let plan: 'free' | 'pro' | 'plus'
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      status = subscription.cancel_at_period_end ? 'cancelled' : 'active'
      plan = paidTier
      break
    case 'past_due':
      status = 'past_due'
      plan = paidTier // access continues while Stripe retries payment
      break
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      // Terminal: the subscription is over (Stripe fires `deleted` at period
      // end for cancel_at_period_end). Revert to Free; the period-end grace
      // window was already covered by the cancelled+plan='pro' state above.
      // Saved creators, invites and history are retained - only locked.
      status = 'cancelled'
      plan = 'free'
      break
    default: // incomplete / paused - no access change yet
      return
  }

  // Resolve the brand: prefer metadata, else look up by the private Stripe customer.
  let resolvedBrandId = brandId || null
  if (!resolvedBrandId && customerId) {
    resolvedBrandId = await getBrandIdByStripeCustomer(supabase, customerId)
  }
  if (!resolvedBrandId) {
    console.error('[WEBHOOK] Subscription has no brand_id metadata or known customer:', subscription.id)
    return
  }

  // Plan/state on the public profile (no Stripe IDs); Stripe IDs stay private.
  await ensureWrite(supabase.from('brand_profiles').update({
    plan,
    subscription_status: status,
    subscription_current_period_end: periodEnd,
  }).eq('id', resolvedBrandId))

  if (customerId) {
    await setBrandStripeCustomer(supabase, resolvedBrandId, customerId, subscription.id)
  }
}

// ── Phase 17: paid Boost activation ───────────────────────────────────────────
// Activated ONLY here, after a Checkout payment succeeds. Idempotent via the
// boost_purchases primary key (the Checkout session id) so duplicate deliveries
// never double-extend. Extends from the later of (now, current expiry), capped.
async function applyBoostFromSession(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  const creatorId = session.metadata?.creator_id
  const boostType = session.metadata?.boost_type
  const days = parseInt(session.metadata?.days || '0', 10)
  if (!creatorId || !['monthly', 'per_app'].includes(boostType || '') || !days) {
    console.error('[WEBHOOK] boost session missing metadata:', session.id)
    return
  }
  if (session.payment_status !== 'paid') return // no payment, no boost

  const { error: claimErr } = await supabase.from('boost_purchases').insert({
    id: session.id,
    creator_id: creatorId,
    boost_type: boostType,
    days,
    amount: session.amount_total ?? null,
  })
  if (claimErr) {
    if (claimErr.code === '23505') return // already activated for this session
    throw claimErr
  }

  const { data: cp } = await supabase.from('creator_profiles')
    .select('boost_active_until').eq('id', creatorId).single()
  const nowMs = Date.now()
  const baseMs = cp?.boost_active_until && new Date(cp.boost_active_until).getTime() > nowMs
    ? new Date(cp.boost_active_until).getTime()
    : nowMs
  const capMs = nowMs + BOOST_MAX_HORIZON_DAYS * 86400000
  const untilMs = Math.min(baseMs + days * 86400000, capMs)
  await ensureWrite(supabase.from('creator_profiles')
    .update({ boost_active_until: new Date(untilMs).toISOString() })
    .eq('id', creatorId))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e: any) {
    console.error('[WEBHOOK] Signature verification failed:', e.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()
  // Insert-and-claim: the FIRST delivery inserts the row (and owns the lock).
  const { error: eventError } = await supabase.from('stripe_events').insert({
    id: event.id,
    event_type: event.type,
    locked_at: nowIso,
  })
  if (eventError?.code === '23505') {
    // The row already exists - another delivery beat us here.
    const { data: prior } = await supabase.from('stripe_events')
      .select('processed_at').eq('id', event.id).single()
    if (prior?.processed_at) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    // Not processed yet. Only take over if the prior lock is STALE (the first
    // attempt likely crashed). A fresh lock means a concurrent delivery is still
    // in-flight, so we exit early and let it finish - no double processing.
    // 3 min: comfortably longer than any handler's worst-case latency (Stripe
    // calls + admin email), so a slow legit handler isn't taken over and re-run.
    const staleBefore = new Date(Date.now() - 180_000).toISOString()
    const { data: claimed } = await supabase.from('stripe_events')
      .update({ locked_at: nowIso })
      .eq('id', event.id)
      .is('processed_at', null)
      .lt('locked_at', staleBefore)
      .select('id')
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ received: true, in_flight: true })
    }
  } else if (eventError) {
    console.error('[WEBHOOK] Could not persist event:', eventError)
    return NextResponse.json({ error: 'Could not persist event' }, { status: 500 })
  }

  try {
    switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      const intent = event.data.object as Stripe.PaymentIntent
      const collabId = intent.metadata?.collab_id
      if (collabId && intent.status === 'requires_capture') {
        await ensureWrite(supabase.from('collabs').update({
          stripe_payment_intent_id: intent.id,
          payment_status: 'funded',
          funded_at: new Date().toISOString(),
          payment_failure_reason: null,
        }).eq('id', collabId)
          .in('payment_status', ['unfunded', 'authorizing', 'funded']))
        // Escrow is now secured: confirm the creator (their first selection
        // signal) and decline leftover applicants if the campaign is full.
        // Best-effort and idempotent — never block the webhook ack.
        try { await notifyCollabFunded(supabase, collabId) }
        catch (e) { console.error('[WEBHOOK] notifyCollabFunded failed:', e) }
      }
      break
    }

    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent
      const collabId = intent.metadata?.collab_id
      if (collabId) {
        await ensureWrite(supabase.from('collabs')
          .update({
            stripe_payment_intent_id: intent.id,
            payment_status: 'captured',
            captured_at: new Date().toISOString(),
            payment_failure_reason: null,
          })
          .eq('id', collabId)
          .not('payment_status', 'in', '("transfer_pending","transfer_failed","paid","manual_exception","refunded")'))
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent
      const collabId = intent.metadata?.collab_id
      if (collabId) {
        await ensureWrite(supabase.from('collabs').update({
          payment_status: paymentStatusFromIntent(intent),
          payment_failure_reason: intent.last_payment_error?.message || 'Payment authorization failed.',
        }).eq('id', collabId)
          .in('payment_status', ['unfunded', 'authorizing', 'funded']))
      }
      break
    }

    case 'payment_intent.canceled': {
      const intent = event.data.object as Stripe.PaymentIntent
      const collabId = intent.metadata?.collab_id
      if (collabId) {
        await ensureWrite(supabase.from('collabs').update({
          payment_status: 'cancelled',
          payment_failure_reason: null,
        }).eq('id', collabId)
          .in('payment_status', ['unfunded', 'authorizing', 'funded', 'capture_failed']))
      }
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      if (typeof charge.payment_intent === 'string') {
        const { data: c } = await supabase.from('collabs')
          .select('id, stripe_transfer_id, payment_status')
          .eq('stripe_payment_intent_id', charge.payment_intent).maybeSingle()
        if (c) {
          const paidOut = Boolean(c.stripe_transfer_id) || ['paid', 'manual_exception'].includes(c.payment_status as string)
          if (paidOut) {
            // Out-of-band refund (e.g. from the Stripe dashboard) on a collab the
            // creator was already PAID for — do NOT clobber to 'refunded' (that
            // would say brand-refunded AND creator-paid). Flag for manual review.
            await ensureWrite(supabase.from('collabs').update({
              payout_review_at: new Date().toISOString(),
              payment_failure_reason: 'A refund was issued on an already-paid collab — manual reconciliation needed.',
            }).eq('id', c.id))
            await sendPayoutAdminEmail('Refund on an already-paid collab — manual review', {
              Event: 'charge.refunded on a collab already paid out to the creator',
              'Payment status': c.payment_status as string,
              Charge: charge.id,
              Collab: link(`/collabs/${c.id}`),
            }, c.id).catch(() => {})
          } else {
            await ensureWrite(supabase.from('collabs').update({
              payment_status: 'refunded',
              refunded_at: new Date().toISOString(),
              payment_failure_reason: null,
            }).eq('id', c.id))
          }
        }
      }
      break
    }

    case 'refund.updated': {
      const refund = event.data.object as Stripe.Refund
      if (typeof refund.payment_intent === 'string') {
        const { data: c } = await supabase.from('collabs')
          .select('id, stripe_transfer_id, payment_status')
          .eq('stripe_payment_intent_id', refund.payment_intent).maybeSingle()
        if (c) {
          const paidOut = Boolean(c.stripe_transfer_id) || ['paid', 'manual_exception'].includes(c.payment_status as string)
          if (paidOut) {
            await ensureWrite(supabase.from('collabs').update({
              payout_review_at: new Date().toISOString(),
              payment_failure_reason: 'A refund was updated on an already-paid collab — manual reconciliation needed.',
            }).eq('id', c.id))
            await sendPayoutAdminEmail('Refund on an already-paid collab — manual review', {
              Event: 'refund.updated on a collab already paid out to the creator',
              'Payment status': c.payment_status as string,
              Refund: refund.id,
              Collab: link(`/collabs/${c.id}`),
            }, c.id).catch(() => {})
          } else {
            const refundStatus = refund.status === 'succeeded'
              ? 'refunded'
              : refund.status === 'pending'
                ? 'refund_pending'
                : 'refund_failed'
            await ensureWrite(supabase.from('collabs').update({
              stripe_refund_id: refund.id,
              payment_status: refundStatus,
              refunded_at: refundStatus === 'refunded' ? new Date().toISOString() : null,
              payment_failure_reason: refundStatus === 'refund_failed' ? `Stripe refund status: ${refund.status}` : null,
            }).eq('id', c.id))
          }
        }
      }
      break
    }

    case 'transfer.reversed': {
      const transfer = event.data.object as Stripe.Transfer
      const { data: c } = await supabase.from('collabs')
        .select('id, payment_status').eq('stripe_transfer_id', transfer.id).maybeSingle()
      if (c) {
        // A reversal of an already-completed payout is NOT a normal retryable
        // 'transfer_failed' (the payout-stuck cron would loop on it forever). Use
        // a distinct terminal state + flag for manual reconciliation.
        await ensureWrite(supabase.from('collabs').update({
          payment_status: 'transfer_reversed',
          payout_review_at: new Date().toISOString(),
          payment_failure_reason: 'Stripe transfer was reversed — manual reconciliation needed.',
        }).eq('id', c.id))
        await sendPayoutAdminEmail('Transfer reversed — manual review', {
          Event: 'transfer.reversed; the creator payout was clawed back',
          'Prior payment status': c.payment_status as string,
          Transfer: transfer.id,
          Collab: link(`/collabs/${c.id}`),
        }, c.id).catch(() => {})
      }
      break
    }

    // ── Pro subscription lifecycle ─────────────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && typeof session.subscription === 'string') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        await applySubscriptionToBrand(supabase, subscription)
      } else if (session.mode === 'payment' && session.metadata?.kind === 'boost') {
        await applyBoostFromSession(supabase, session)
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await applySubscriptionToBrand(supabase, event.data.object as Stripe.Subscription)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await applySubscriptionToBrand(supabase, { ...subscription, status: 'canceled' } as Stripe.Subscription)
      break
    }

    case 'account.updated': {
      const account = event.data.object as any
      if (account.details_submitted) {
        await ensureWrite(supabase.from('creator_profiles')
          .update({ stripe_connect_id: account.id })
          .eq('stripe_connect_id', account.id))
      }
      // The creator can now receive money: immediately release any payouts that
      // were stuck (captured-but-not-transferred) waiting on this account,
      // instead of waiting for the next auto-release cron run. Idempotent.
      if (account.payouts_enabled) {
        try {
          const released = await retryStuckPayoutsForAccount(supabase, account.id)
          if (released) console.log(`[WEBHOOK] account.updated released ${released} stuck payout(s) for ${account.id}`)
        } catch (e) { console.error('[WEBHOOK] stuck-payout retry failed:', e) }
      }
      break
    }

    default:
      // Unhandled event type - not an error
      break
    }
  } catch (error) {
    console.error(`[WEBHOOK] Failed to process ${event.id}:`, error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  const { error: processedError } = await supabase.from('stripe_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', event.id)
  if (processedError) {
    return NextResponse.json({ error: 'Could not mark event processed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
