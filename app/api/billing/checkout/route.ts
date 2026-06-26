import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe, brandProPriceIds, brandPlusPriceIds, brandPlusBetaPriceIds } from '@/lib/stripe'
import { isBetaFreePro, PLAN_COLUMNS } from '@/lib/plans'
import { getBrandStripeCustomerId, setBrandStripeCustomer } from '@/lib/brand-billing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Starts a Stripe Checkout subscription for a Brand tier (Pro or Plus). Pricing
// lives in Stripe (recurring Price IDs) — never hardcoded in the product.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Brand Pro is free in beta; Plus is still purchasable (it's gated, not free).
  const body = await req.json().catch(() => ({}))
  const tier: 'pro' | 'plus' = body?.tier === 'plus' ? 'plus' : 'pro'
  const cycle: 'monthly' | 'annual' = body?.cycle === 'annual' ? 'annual' : 'monthly'

  if (tier === 'pro' && isBetaFreePro()) {
    return NextResponse.json(
      { error: 'Pro is complimentary during the collabr beta, no subscription needed.' },
      { status: 409 }
    )
  }

  // Plus is 50% off during beta (beta price IDs), falling back to full price.
  const priceId = tier === 'plus'
    ? ((isBetaFreePro() ? brandPlusBetaPriceIds()[cycle] : null) || brandPlusPriceIds()[cycle])
    : brandProPriceIds()[cycle]
  if (!priceId) {
    console.error(`[BILLING] Brand ${tier} ${cycle} price is not configured`)
    return NextResponse.json({ error: 'This plan is not available yet.' }, { status: 503 })
  }

  const { data: account } = await supabase.from('users').select('role, email').eq('id', user.id).single()
  if (account?.role !== 'brand') {
    return NextResponse.json({ error: 'Only brands can subscribe to Pro' }, { status: 403 })
  }
  const admin = createAdminClient()
  // Admin client: subscription columns are server-only.
  const { data: brand } = await admin.from('brand_profiles')
    .select(`id, company_name, ${PLAN_COLUMNS}`)
    .eq('user_id', user.id).single()
  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
  if (brand.plan === tier && brand.subscription_status === 'active') {
    return NextResponse.json({ error: `You already have an active ${tier === 'plus' ? 'Plus' : 'Pro'} subscription` }, { status: 409 })
  }

  // Reuse or create the Stripe customer (stored privately in brand_subscriptions).
  let customerId = await getBrandStripeCustomerId(admin, brand.id)
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: account?.email || user.email || undefined,
      name: brand.company_name || undefined,
      metadata: { brand_id: brand.id, user_id: user.id },
    })
    customerId = customer.id
    await setBrandStripeCustomer(admin, brand.id, customerId)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/billing?subscribed=1`,
    cancel_url: `${APP_URL}/billing`,
    metadata: { brand_id: brand.id, tier },
    subscription_data: { metadata: { brand_id: brand.id, tier } },
  })

  return NextResponse.json({ url: session.url })
}
