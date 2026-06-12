import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { paymentStatusFromIntent } from '@/lib/payments'
import Stripe from 'stripe'

async function ensureWrite(result: PromiseLike<{ error: any }>) {
  const { error } = await result
  if (error) throw error
}

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
  const { error: eventError } = await supabase.from('stripe_events').insert({
    id: event.id,
    event_type: event.type,
  })
  if (eventError?.code === '23505') {
    const { data: prior } = await supabase.from('stripe_events')
      .select('processed_at').eq('id', event.id).single()
    if (prior?.processed_at) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  } else if (eventError) {
    console.error('[WEBHOOK] Could not persist event:', eventError)
    return NextResponse.json({ error: 'Could not persist event' }, { status: 500 })
  }

  try {
    switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      const intent = event.data.object as Stripe.PaymentIntent
      const collabId = intent.metadata?.collab_id
      if (collabId && intent.status === 'requires_capture') {
        await ensureWrite(supabase.from('collabs').update({
          stripe_payment_intent_id: intent.id,
          payment_status: 'funded',
          funded_at: new Date().toISOString(),
          payment_failure_reason: null,
        }).eq('id', collabId)
          .in('payment_status', ['unfunded', 'authorizing', 'funded']))
      }
      break
    }

    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent
      const collabId = intent.metadata?.collab_id
      if (collabId) {
        await ensureWrite(supabase.from('collabs')
          .update({
            stripe_payment_intent_id: intent.id,
            payment_status: 'captured',
            captured_at: new Date().toISOString(),
            payment_failure_reason: null,
          })
          .eq('id', collabId)
          .not('payment_status', 'in', '("transfer_pending","transfer_failed","paid","manual_exception","refunded")'))
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent
      const collabId = intent.metadata?.collab_id
      if (collabId) {
        await ensureWrite(supabase.from('collabs').update({
          payment_status: paymentStatusFromIntent(intent),
          payment_failure_reason: intent.last_payment_error?.message || 'Payment authorization failed.',
        }).eq('id', collabId)
          .in('payment_status', ['unfunded', 'authorizing', 'funded']))
      }
      break
    }

    case 'payment_intent.canceled': {
      const intent = event.data.object as Stripe.PaymentIntent
      const collabId = intent.metadata?.collab_id
      if (collabId) {
        await ensureWrite(supabase.from('collabs').update({
          payment_status: 'cancelled',
          payment_failure_reason: null,
        }).eq('id', collabId)
          .in('payment_status', ['unfunded', 'authorizing', 'funded', 'capture_failed']))
      }
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      if (typeof charge.payment_intent === 'string') {
        await ensureWrite(supabase.from('collabs').update({
          payment_status: 'refunded',
          refunded_at: new Date().toISOString(),
          payment_failure_reason: null,
        }).eq('stripe_payment_intent_id', charge.payment_intent))
      }
      break
    }

    case 'refund.updated': {
      const refund = event.data.object as Stripe.Refund
      if (typeof refund.payment_intent === 'string') {
        const refundStatus = refund.status === 'succeeded'
          ? 'refunded'
          : refund.status === 'pending'
            ? 'refund_pending'
            : 'refund_failed'
        await ensureWrite(supabase.from('collabs').update({
          stripe_refund_id: refund.id,
          payment_status: refundStatus,
          refunded_at: refundStatus === 'refunded' ? new Date().toISOString() : null,
          payment_failure_reason: refundStatus === 'refund_failed' ? `Stripe refund status: ${refund.status}` : null,
        }).eq('stripe_payment_intent_id', refund.payment_intent))
      }
      break
    }

    case 'transfer.reversed': {
      const transfer = event.data.object as Stripe.Transfer
      await ensureWrite(supabase.from('collabs').update({
        payment_status: 'transfer_failed',
        payment_failure_reason: 'Stripe transfer was reversed.',
      }).eq('stripe_transfer_id', transfer.id))
      break
    }

    case 'account.updated': {
      const account = event.data.object as any
      if (account.details_submitted) {
        await ensureWrite(supabase.from('creator_profiles')
          .update({ stripe_connect_id: account.id })
          .eq('stripe_connect_id', account.id))
      }
      break
    }

    default:
      // Unhandled event type — not an error
      break
    }
  } catch (error) {
    console.error(`[WEBHOOK] Failed to process ${event.id}:`, error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  const { error: processedError } = await supabase.from('stripe_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', event.id)
  if (processedError) {
    return NextResponse.json({ error: 'Could not mark event processed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
