import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator') return NextResponse.json({ error: 'Creators only' }, { status: 403 })

  const { plan } = await req.json() // 'monthly' | 'per_app'
  if (!['monthly', 'per_app'].includes(plan)) {
    return NextResponse.json({ error: 'plan must be monthly or per_app' }, { status: 400 })
  }

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, boost_active_until').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  const daysToAdd = plan === 'monthly' ? 30 : 7
  const base = creator.boost_active_until && new Date(creator.boost_active_until) > new Date()
    ? new Date(creator.boost_active_until)
    : new Date()
  const boostUntil = new Date(base.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString()

  // In beta, activate without Stripe payment — charge will be added in Phase 6
  const noStripe = !process.env.STRIPE_SECRET_KEY
  if (!noStripe) {
    // TODO Phase 6: create Stripe Checkout session for $4 / $20 SGD
    // For now activate immediately once Stripe is wired for subscriptions
  }

  await supabase.from('creator_profiles')
    .update({ boost_active_until: boostUntil }).eq('id', creator.id)

  return NextResponse.json({ success: true, boost_active_until: boostUntil, plan })
}
