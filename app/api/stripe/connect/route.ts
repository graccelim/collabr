import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// POST: create / retrieve Connect account and return onboarding URL
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator') return NextResponse.json({ error: 'Creators only' }, { status: 403 })

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, stripe_connect_id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  let accountId: string = creator.stripe_connect_id

  if (!accountId) {
    const { data: userRow } = await supabase.from('users')
      .select('email').eq('id', user.id).single()
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'SG',
      email: userRow?.email,
      capabilities: { transfers: { requested: true } },
      metadata: { user_id: user.id, creator_id: creator.id },
    })
    accountId = account.id
    await supabase.from('creator_profiles')
      .update({ stripe_connect_id: accountId }).eq('id', creator.id)
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/earnings?connect=refresh`,
    return_url: `${APP_URL}/earnings?connect=complete`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: accountLink.url })
}

// GET: return current Connect account status
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: creator } = await supabase.from('creator_profiles')
    .select('stripe_connect_id').eq('user_id', user.id).single()

  if (!creator?.stripe_connect_id) return NextResponse.json({ status: 'not_connected' })

  const account = await stripe.accounts.retrieve(creator.stripe_connect_id)
  return NextResponse.json({
    status: account.details_submitted ? 'active' : 'pending',
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
  })
}
