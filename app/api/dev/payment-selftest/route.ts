import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

// DEV payment self-test. Runs the real escrow → capture → transfer path against
// your Stripe account IN TEST MODE, so you can validate payouts without touching
// live keys or clicking through the whole UI.
//
// Safety: refuses unless STRIPE_SECRET_KEY is sk_test (never runs on live), and
// requires ?token=<CRON_SECRET>. Delete this route before/after go-live.
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized. Append ?token=<CRON_SECRET>.' }, { status: 401 })
  }
  const key = process.env.STRIPE_SECRET_KEY || ''
  if (!key.startsWith('sk_test')) {
    return NextResponse.json({ error: 'Refusing to run: Stripe is not in TEST mode (key is not sk_test). This route never runs on live keys.' }, { status: 403 })
  }

  const steps: Array<Record<string, unknown>> = []
  const push = (step: string, ok: boolean, data: Record<string, unknown> = {}) => steps.push({ step, ok, ...data })
  const provided = req.nextUrl.searchParams.get('connect') || undefined

  // 1) Connect account: use a provided (already-onboarded) test account, else make a throwaway.
  let connectId = provided
  let transfersActive = false
  try {
    if (connectId) {
      const acct = await stripe.accounts.retrieve(connectId)
      transfersActive = acct.capabilities?.transfers === 'active'
      push('use_connect_account', true, { account: connectId, transfers: acct.capabilities?.transfers })
    } else {
      const acct = await stripe.accounts.create({
        type: 'custom', country: 'SG', email: 'selftest+creator@collabr.test',
        business_type: 'individual',
        capabilities: { transfers: { requested: true } },
        business_profile: { mcc: '5815', product_description: 'Content creation', url: 'https://www.joincollabr.com' },
        individual: {
          first_name: 'Test', last_name: 'Creator', email: 'selftest+creator@collabr.test',
          dob: { day: 1, month: 1, year: 1990 },
          address: { line1: '1 Raffles Place', city: 'Singapore', postal_code: '048616', country: 'SG' },
          phone: '+6580000000', id_number: '000000000',
        },
        tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
      })
      connectId = acct.id
      transfersActive = acct.capabilities?.transfers === 'active'
      push('create_connect_account', true, { account: connectId, transfers: acct.capabilities?.transfers, note: 'throwaway TEST account — delete later' })
    }
  } catch (e) {
    push('connect_account', false, { error: (e as Error).message, hint: 'If this fails, Connect may not be enabled in test mode (Stripe → Connect → Get started).' })
  }

  // 2) Authorize a held payment (escrow) — manual capture, S$5.00.
  let piId: string | undefined
  try {
    const pi = await stripe.paymentIntents.create({
      amount: 500, currency: 'sgd', capture_method: 'manual',
      payment_method: 'pm_card_visa', confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: 'Collabr payment self-test',
    })
    piId = pi.id
    push('authorize_escrow', pi.status === 'requires_capture', { paymentIntent: pi.id, status: pi.status })
  } catch (e) {
    push('authorize_escrow', false, { error: (e as Error).message })
  }

  // 3) Capture (funds move to the platform balance, tied to this charge).
  let chargeId: string | undefined
  if (piId) {
    try {
      const cap = await stripe.paymentIntents.capture(piId)
      chargeId = typeof cap.latest_charge === 'string' ? cap.latest_charge : undefined
      push('capture', cap.status === 'succeeded', { status: cap.status, charge: chargeId })
    } catch (e) {
      push('capture', false, { error: (e as Error).message })
    }
  }

  // 4) Transfer the creator payout (S$4.50 after a 10% fee) to the Connect account.
  if (chargeId && connectId) {
    try {
      const tr = await stripe.transfers.create({
        amount: 450, currency: 'sgd', destination: connectId,
        source_transaction: chargeId, transfer_group: 'collab:selftest',
        metadata: { selftest: 'true' },
      })
      push('transfer_to_creator', true, { transfer: tr.id, amount: 'S$4.50', destination: connectId })
    } catch (e) {
      push('transfer_to_creator', false, {
        error: (e as Error).message,
        hint: transfersActive ? undefined : 'Destination transfers capability is not active. Onboard a test creator through the app, then re-run with ?connect=acct_xxx.',
      })
    }
  }

  const ok = steps.length > 0 && steps.every((s) => s.ok)
  return NextResponse.json({
    mode: 'TEST',
    ok,
    summary: ok
      ? 'Escrow → capture → transfer all succeeded in TEST mode. Open the Stripe test dashboard to see them.'
      : 'Some steps did not pass — check steps[].error below.',
    steps,
    viewInStripe: ['dashboard.stripe.com/test/payments', 'dashboard.stripe.com/test/connect/transfers'],
  })
}
