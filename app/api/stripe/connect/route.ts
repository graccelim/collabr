import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// A saved Connect id can go stale: the account was created under different
// Stripe keys (test vs live) or another platform, or was deleted. Stripe then
// rejects it with "does not exist / not connected to your platform".
function isUnusableAccount(e: any): boolean {
  return e?.type === 'StripeInvalidRequestError' && (
    e?.code === 'account_invalid' ||
    /no such account|does not exist|not connected to your platform/i.test(e?.message ?? '')
  )
}

// Live mode blocks account creation until the Connect platform profile
// (loss-liability questionnaire) is completed in the Stripe dashboard.
function isPlatformProfileError(e: any): boolean {
  return /platform-profile|responsibilities of managing losses/i.test(e?.message ?? '')
}

// POST: create / retrieve Connect account and return onboarding URL
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator') return NextResponse.json({ error: 'Creators only' }, { status: 403 })

  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles')
    .select('id, stripe_connect_id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  try {
    let accountId: string | null = creator.stripe_connect_id

    // Verify the stored account is still usable before linking to it; if it
    // isn't, forget it and start fresh instead of failing the whole flow.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId)
      } catch (e) {
        if (!isUnusableAccount(e)) throw e
        accountId = null
        await admin.from('creator_profiles')
          .update({ stripe_connect_id: null }).eq('id', creator.id)
      }
    }

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
      await admin.from('creator_profiles')
        .update({ stripe_connect_id: accountId }).eq('id', creator.id)
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}/earnings?connect=refresh`,
      return_url: `${APP_URL}/earnings?connect=complete`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (e: any) {
    console.error('[STRIPE_CONNECT]', e)
    if (isPlatformProfileError(e)) {
      return NextResponse.json(
        { error: 'Payout setup is temporarily unavailable while we finish our Stripe configuration. Please try again a little later.' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: e?.message || 'Could not start payout setup' },
      { status: 500 },
    )
  }
}

// GET: return current Connect account status
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles')
    .select('stripe_connect_id').eq('user_id', user.id).single()

  if (!creator?.stripe_connect_id) return NextResponse.json({ status: 'not_connected' })

  try {
    const account = await stripe.accounts.retrieve(creator.stripe_connect_id)
    return NextResponse.json({
      status: account.details_submitted ? 'active' : 'pending',
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    })
  } catch (e: any) {
    console.error('[STRIPE_CONNECT_STATUS]', e)
    // A stale id reads as "not connected" so the UI offers a fresh start.
    if (isUnusableAccount(e)) return NextResponse.json({ status: 'not_connected' })
    return NextResponse.json({ error: 'Could not load payout status' }, { status: 500 })
  }
}
