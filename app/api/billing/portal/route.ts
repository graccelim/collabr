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
  if (account?.role !== 'brand') {
    return NextResponse.json({ error: 'Only brands have billing portals' }, { status: 403 })
  }

  // Stripe customer id lives in the private brand_subscriptions table.
  const admin = createAdminClient()
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
