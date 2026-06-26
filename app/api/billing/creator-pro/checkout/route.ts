import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe, creatorProEnabled, creatorProPriceIds } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'
import { flags } from '@/lib/flags'

// Creator Pro subscription checkout. Mirrors the Boost pattern: this route ONLY
// creates a Stripe Checkout session (mode: subscription). The subscription is
// activated by the isolated webhook (stripe-creator-pro) after Stripe confirms
// payment/trial — never here. Does not touch escrow/boost/Phyllo/AI.
const CREATOR_PRO_TRIAL_DAYS = 7

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (roleRow?.role !== 'creator') return NextResponse.json({ error: 'Creators only' }, { status: 403 })

  if (!creatorProEnabled()) {
    return NextResponse.json({ error: 'Creator Pro is not available yet.' }, { status: 503 })
  }

  if (!checkRateLimit(`creator-pro:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const type = body?.type
  if (!['monthly', 'annual'].includes(type)) {
    return NextResponse.json({ error: 'type must be monthly or annual' }, { status: 400 })
  }
  const priceId = creatorProPriceIds()[type as 'monthly' | 'annual']
  if (!priceId) return NextResponse.json({ error: 'This plan is not available.' }, { status: 503 })

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, onboarding_completed_at').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
  if (!creator.onboarding_completed_at) {
    return NextResponse.json({ error: 'Complete your creator profile first.' }, { status: 403 })
  }

  // Reuse an existing Stripe customer (so renewals don't create duplicates).
  const admin = createAdminClient()
  const { data: sub } = await admin.from('creator_subscriptions')
    .select('stripe_customer_id').eq('creator_id', creator.id).maybeSingle()
  let customerId = sub?.stripe_customer_id || null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { creator_id: creator.id, kind: 'creator_pro' },
    })
    customerId = customer.id
    await admin.from('creator_subscriptions').upsert(
      { creator_id: creator.id, stripe_customer_id: customerId, status: 'none', updated_at: new Date().toISOString() },
      { onConflict: 'creator_id' },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const rt = typeof body?.returnTo === 'string' ? body.returnTo : ''
  const returnTo = rt.startsWith('/') && !rt.startsWith('//') ? rt : '/studio'
  const sep = returnTo.includes('?') ? '&' : '?'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: CREATOR_PRO_TRIAL_DAYS,
        metadata: { kind: 'creator_pro', creator_id: creator.id },
      },
      success_url: `${appUrl}${returnTo}${sep}pro=success`,
      cancel_url: `${appUrl}${returnTo}${sep}pro=canceled`,
      metadata: { kind: 'creator_pro', creator_id: creator.id },
    })
    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('[CREATOR_PRO] Checkout session failed:', e?.message)
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
  }
}
