import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { stripeStatusToPro } from '@/lib/entitlements'
import { flags } from '@/lib/flags'

// ISOLATED Creator Pro subscription webhook — separate Stripe endpoint with its
// OWN signing secret (STRIPE_CREATOR_PRO_WEBHOOK_SECRET). It never touches the
// escrow webhook (/api/webhooks/stripe) or its events. Writes only to the private
// creator_subscriptions table. Idempotent: it always upserts the CURRENT
// subscription state keyed by creator_id, so re-delivery is harmless.

type SupabaseAdmin = ReturnType<typeof createAdminClient>

async function applySubscription(
  admin: SupabaseAdmin,
  creatorId: string,
  sub: Stripe.Subscription,
  deleted = false,
) {
  const status = deleted ? 'canceled' : stripeStatusToPro(sub.status)
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null
  const priceId = sub.items?.data?.[0]?.price?.id ?? null

  await admin.from('creator_subscriptions').upsert(
    {
      creator_id: creatorId,
      status,
      // Access end. Stripe drives expiry; entitlements freeze once this passes.
      pro_until: periodEnd,
      current_period_end: periodEnd,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      price_id: priceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'creator_id' },
  )
}

export async function POST(req: NextRequest) {
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_CREATOR_PRO_WEBHOOK_SECRET

  if (!signature || !secret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (e: any) {
    console.error('[CREATOR_PRO_WEBHOOK] Signature verification failed:', e.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        // Only our subscriptions — ignore anything else delivered here.
        if (s.metadata?.kind !== 'creator_pro' || !s.subscription) break
        const creatorId = s.metadata?.creator_id
        if (!creatorId) break
        const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription.id
        const sub = await stripe.subscriptions.retrieve(subId)
        await applySubscription(admin, creatorId, sub)
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const creatorId = sub.metadata?.creator_id
        if (!creatorId) break // not a Creator Pro subscription
        await applySubscription(admin, creatorId, sub, event.type === 'customer.subscription.deleted')
        break
      }
      default:
        break // ignore everything else
    }
  } catch (e: any) {
    console.error('[CREATOR_PRO_WEBHOOK] Handler error:', e?.message)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
