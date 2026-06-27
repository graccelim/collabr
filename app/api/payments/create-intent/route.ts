import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { persistIntentTruth } from '@/lib/payments'
import { getBrandStripeCustomerId, setBrandStripeCustomer } from '@/lib/brand-billing'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { collab_id } = await req.json()
  if (!collab_id) return NextResponse.json({ error: 'collab_id required' }, { status: 400 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, brand_profiles(user_id, plan)')
    .eq('id', collab_id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visibleBrand = collab.brand_profiles as any
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

  // Return and synchronize an existing intent instead of treating its ID as funding.
  if (collab.stripe_payment_intent_id) {
    const existing = await stripe.paymentIntents.retrieve(collab.stripe_payment_intent_id)
    const paymentStatus = await persistIntentTruth(admin, collab_id, existing)
    if (paymentStatus === 'funded') {
      return NextResponse.json({ payment_status: paymentStatus })
    }
    if (existing.client_secret && ['unfunded', 'authorizing'].includes(paymentStatus)) {
      return NextResponse.json({ client_secret: existing.client_secret })
    }
    return NextResponse.json({ error: `Payment is already ${paymentStatus}` }, { status: 409 })
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

  const intent = await stripe.paymentIntents.create({
    amount: collab.agreed_rate,       // already in SGD cents
    currency: 'sgd',
    capture_method: 'manual',         // funds held until we capture on live confirmation
    customer: customerId,
    payment_method_types: ['card'],
    metadata: {
      collab_id,
      creator_payout: String(collab.creator_payout),
      platform_fee: String(collab.platform_fee),
    },
    description: `collabr. escrow, collab ${collab_id}`,
  }, {
    idempotencyKey: `collab:${collab_id}:payment-intent`,
  })

  await admin.from('collabs')
    .update({
      stripe_payment_intent_id: intent.id,
      payment_status: 'authorizing',
      payment_failure_reason: null,
    }).eq('id', collab_id)

  return NextResponse.json({ client_secret: intent.client_secret })
}
