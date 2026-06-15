import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe, boostEnabled, boostPriceIds, BOOST_DAYS } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'

// Creator purchases a paid Boost. This route ONLY creates a Stripe Checkout
// session — the boost is activated by the webhook (checkout.session.completed,
// kind=boost) after the payment actually succeeds. No payment, no boost.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator') return NextResponse.json({ error: 'Creators only' }, { status: 403 })

  if (!boostEnabled()) {
    return NextResponse.json({ error: 'Boost is not available yet.' }, { status: 503 })
  }

  // Anti-spam: cap checkout-session creation per creator.
  if (!checkRateLimit(`boost:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const type = body?.type
  if (!['monthly', 'per_app'].includes(type)) {
    return NextResponse.json({ error: 'type must be monthly or per_app' }, { status: 400 })
  }

  const priceId = boostPriceIds()[type as 'monthly' | 'per_app']
  if (!priceId) {
    return NextResponse.json({ error: 'This boost option is not available.' }, { status: 503 })
  }

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, onboarding_completed_at').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
  if (!creator.onboarding_completed_at) {
    return NextResponse.json({ error: 'Complete your creator profile before boosting.' }, { status: 403 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      success_url: `${appUrl}/boost?success=1`,
      cancel_url: `${appUrl}/boost?canceled=1`,
      metadata: {
        kind: 'boost',
        creator_id: creator.id,
        boost_type: type,
        days: String(BOOST_DAYS[type as 'monthly' | 'per_app']),
      },
    })
    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('[BOOST] Checkout session failed:', e?.message)
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
  }
}
