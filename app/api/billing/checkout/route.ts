import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { isBetaFreePro, PLAN_COLUMNS } from '@/lib/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Starts a Stripe Checkout subscription for collabr Pro. Pricing lives in
// Stripe (STRIPE_PRO_PRICE_ID) - never hardcoded in the product.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (isBetaFreePro()) {
    return NextResponse.json(
      { error: 'Pro is complimentary during the collabr beta, no subscription needed.' },
      { status: 409 }
    )
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID
  if (!priceId) {
    console.error('[BILLING] STRIPE_PRO_PRICE_ID is not configured')
    return NextResponse.json({ error: 'Subscriptions are not available yet.' }, { status: 503 })
  }

  const { data: account } = await supabase.from('users').select('role, email').eq('id', user.id).single()
  if (account?.role !== 'brand') {
    return NextResponse.json({ error: 'Only brands can subscribe to Pro' }, { status: 403 })
  }
  const admin = createAdminClient()
  // Admin client: stripe_customer_id / subscription columns are server-only.
  const { data: brand } = await admin.from('brand_profiles')
    .select(`id, stripe_customer_id, company_name, ${PLAN_COLUMNS}`)
    .eq('user_id', user.id).single()
  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
  if (brand.plan === 'pro' && brand.subscription_status === 'active') {
    return NextResponse.json({ error: 'You already have an active Pro subscription' }, { status: 409 })
  }

  // Reuse or create the Stripe customer.
  let customerId = brand.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: account?.email || user.email || undefined,
      name: brand.company_name || undefined,
      metadata: { brand_id: brand.id, user_id: user.id },
    })
    customerId = customer.id
    await admin.from('brand_profiles')
      .update({ stripe_customer_id: customerId }).eq('id', brand.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/billing?subscribed=1`,
    cancel_url: `${APP_URL}/billing`,
    metadata: { brand_id: brand.id },
    subscription_data: { metadata: { brand_id: brand.id } },
  })

  return NextResponse.json({ url: session.url })
}
