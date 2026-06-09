import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e: any) {
    console.error('[WEBHOOK] Signature verification failed:', e.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as any
      const collabId = intent.metadata?.collab_id
      if (collabId) {
        await supabase.from('collabs')
          .update({ stripe_payment_intent_id: intent.id })
          .eq('id', collabId)
          .is('stripe_payment_intent_id', null)
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as any
      const collabId = intent.metadata?.collab_id
      if (collabId) {
        console.error(`[WEBHOOK] Payment failed for collab ${collabId}: ${intent.last_payment_error?.message}`)
        // Collab stays in 'briefed' — brand can retry payment
      }
      break
    }

    case 'account.updated': {
      const account = event.data.object as any
      if (account.details_submitted) {
        await supabase.from('creator_profiles')
          .update({ stripe_connect_id: account.id })
          .eq('stripe_connect_id', account.id)
      }
      break
    }

    default:
      // Unhandled event type — not an error
      break
  }

  return NextResponse.json({ received: true })
}
