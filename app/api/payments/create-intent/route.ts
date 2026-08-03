import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { persistIntentTruth } from '@/lib/payments'
import { getBrandStripeCustomerId, setBrandStripeCustomer } from '@/lib/brand-billing'
import { flags } from '@/lib/flags'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  // Emergency stop only - escrow itself stays live by default (see
  // flags.escrowLive doc comment). Existing funded/captured collabs are
  // unaffected; this only blocks minting a NEW payment intent.
  if (!flags.escrowLive) {
    return NextResponse.json({ error: 'Payments are temporarily paused. Please try again shortly.' }, { status: 503 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { collab_id } = await req.json()
  if (!collab_id) return NextResponse.json({ error: 'collab_id required' }, { status: 400 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, brand_profiles(user_id, plan), campaigns(title)')
    .eq('id', collab_id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visibleBrand = collab.brand_profiles as any
  const campaignTitle = (collab.campaigns as { title?: string } | null)?.title
  if (visibleBrand?.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['briefed'].includes(collab.status)) {
    return NextResponse.json({ error: 'Payment already processed for this collab' }, { status: 400 })
  }
  // Barter collabs have no cash (agreed_rate 0) and are already 'funded' — there
  // is nothing to charge. Guard so this never reaches Stripe with amount 0.
  if (!collab.agreed_rate || collab.agreed_rate <= 0) {
    return NextResponse.json({ error: 'This is a barter collaboration, there is no payment to make.' }, { status: 400 })
  }

  const admin = createAdminClient()
  // Brand Stripe customer lives in the private brand_subscriptions table.
  const existingCustomerId = await getBrandStripeCustomerId(admin, collab.brand_id)

  // If a previous attempt already produced an intent, check its TRUE status
  // before minting a new one - funded/captured must short-circuit (never
  // double-charge). An abandoned/unfunded prior attempt just falls through to
  // a fresh Checkout Session below - Checkout Sessions are meant to be
  // single-use and expire, unlike a raw PaymentIntent's client_secret, so
  // there's no "resume the old one" path anymore.
  if (collab.stripe_payment_intent_id) {
    const existing = await stripe.paymentIntents.retrieve(collab.stripe_payment_intent_id)
    const paymentStatus = await persistIntentTruth(admin, collab_id, existing)
    if (paymentStatus !== 'unfunded' && paymentStatus !== 'authorizing') {
      return NextResponse.json({ payment_status: paymentStatus })
    }
  }

  // Get or create Stripe customer for brand
  let customerId: string = existingCustomerId || ''
  if (!customerId) {
    const { data: userProfile } = await supabase.from('users')
      .select('email, display_name').eq('id', user.id).single()
    const customer = await stripe.customers.create({
      email: userProfile?.email,
      name: userProfile?.display_name || undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id
    await setBrandStripeCustomer(admin, collab.brand_id, customerId)
  }

  // Hosted Stripe Checkout instead of an embedded card form: a brand arriving
  // cold (via personal outreach, not self-serve signup) has zero reason yet to
  // trust a card form living on collabr's own page - it's visually
  // indistinguishable from a phishing form. Redirecting to Stripe's own
  // checkout.stripe.com page inherits Stripe's recognizable branding instead.
  // Escrow semantics are unchanged: payment_intent_data.capture_method stays
  // 'manual' (funds authorized now, captured later on live-post approval), so
  // the Checkout Session still creates a PaymentIntent with the same shape and
  // metadata the webhook handlers and capture call already key off — nothing
  // downstream of creation needed to change.
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'sgd',
        unit_amount: collab.agreed_rate, // already in SGD cents
        product_data: {
          name: `collabr. protected payment — ${campaignTitle || 'collaboration'}`,
          description: 'Held securely until you approve the delivered work.',
        },
      },
      quantity: 1,
    }],
    payment_intent_data: {
      capture_method: 'manual',
      metadata: {
        collab_id,
        creator_payout: String(collab.creator_payout),
        platform_fee: String(collab.platform_fee),
      },
    },
    metadata: { collab_id },
    success_url: `${APP_URL}/collabs/${collab_id}?funded=1`,
    cancel_url: `${APP_URL}/collabs/${collab_id}`,
  })

  // session.payment_intent is a string id here (not expanded) - available
  // synchronously, so we can persist it immediately exactly as before.
  await admin.from('collabs')
    .update({
      stripe_payment_intent_id: session.payment_intent as string,
      payment_status: 'authorizing',
      payment_failure_reason: null,
    }).eq('id', collab_id)

  return NextResponse.json({ url: session.url })
}
