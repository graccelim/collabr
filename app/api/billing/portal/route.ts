import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getBrandStripeCustomerId } from '@/lib/brand-billing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Opens the Stripe Billing Portal: payment method updates, invoices, and
// cancellation. Cancellation flows back through webhooks; access remains
// until the period ends (resolvePlan honors subscription_current_period_end).
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabase.from('users').select('role').eq('id', user.id).single()
  const admin = createAdminClient()

  // Creators manage (and can CANCEL) their Creator Pro subscription here too —
  // the panel promises "Cancel anytime", so a cancellation path must exist.
  if (account?.role === 'creator') {
    const { data: creator } = await admin.from('creator_profiles')
      .select('id').eq('user_id', user.id).single()
    const { data: sub } = creator
      ? await admin.from('creator_subscriptions')
          .select('stripe_customer_id').eq('creator_id', creator.id).maybeSingle()
      : { data: null }
    if (!sub?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account yet, subscribe to Creator Pro first.' },
        { status: 404 }
      )
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${APP_URL}/studio`,
    })
    return NextResponse.json({ url: session.url })
  }

  if (account?.role !== 'brand') {
    return NextResponse.json({ error: 'No billing portal for this account' }, { status: 403 })
  }

  // Stripe customer id lives in the private brand_subscriptions table.
  const { data: brand } = await admin.from('brand_profiles')
    .select('id').eq('user_id', user.id).single()
  const customerId = brand ? await getBrandStripeCustomerId(admin, brand.id) : null
  if (!customerId) {
    return NextResponse.json(
      { error: 'No billing account yet, subscribe to Pro first.' },
      { status: 404 }
    )
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
