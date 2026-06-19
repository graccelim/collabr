import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

type AdminClient = SupabaseClient<any, 'public', any>

type PaymentCollab = {
  id: string
  creator_id: string
  agreed_rate: number
  creator_payout: number
  stripe_payment_intent_id: string | null
  stripe_transfer_id?: string | null
  stripe_refund_id?: string | null
  payment_status: string
}

type SettlementResult = {
  ok: boolean
  completed?: boolean
  paymentStatus: string
  error?: string
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown Stripe error'
}

async function updateCollab(
  admin: AdminClient,
  collabId: string,
  updates: Record<string, unknown>,
) {
  const { error } = await admin.from('collabs').update(updates).eq('id', collabId)
  if (error) throw error
}

/**
 * Complete a BARTER collab (agreed_rate 0): nothing to capture or transfer.
 * Mark it settled (`manual_exception`, which satisfies the completion
 * constraint) and finalize — the creator earns 0 cash. No Stripe involved.
 */
export async function completeBarterCollab(admin: AdminClient, collabId: string): Promise<SettlementResult> {
  const now = new Date().toISOString()
  await updateCollab(admin, collabId, { payment_status: 'manual_exception', captured_at: now, paid_at: now })
  await admin.rpc('finalize_paid_collab', { p_collab_id: collabId, p_creator_earned: 0 })
  return { ok: true, completed: true, paymentStatus: 'manual_exception' }
}

export function paymentStatusFromIntent(intent: Stripe.PaymentIntent) {
  switch (intent.status) {
    case 'requires_capture':
      return 'funded'
    case 'processing':
    case 'requires_action':
    case 'requires_confirmation':
      return 'authorizing'
    case 'succeeded':
      return 'captured'
    case 'canceled':
      return 'cancelled'
    default:
      return 'unfunded'
  }
}

export async function persistIntentTruth(
  admin: AdminClient,
  collabId: string,
  intent: Stripe.PaymentIntent,
) {
  const paymentStatus = paymentStatusFromIntent(intent)
  const updates: Record<string, unknown> = {
    stripe_payment_intent_id: intent.id,
    payment_status: paymentStatus,
    payment_failure_reason: intent.last_payment_error?.message || null,
  }

  if (paymentStatus === 'funded') updates.funded_at = new Date().toISOString()
  if (paymentStatus === 'captured') updates.captured_at = new Date().toISOString()

  await updateCollab(admin, collabId, updates)
  return paymentStatus
}

export async function captureTransferAndComplete(
  admin: AdminClient,
  collab: PaymentCollab,
  amounts?: { captureAmount: number; creatorPayout: number },
): Promise<SettlementResult> {
  if (['paid', 'manual_exception'].includes(collab.payment_status)) {
    const { data: completed, error } = await admin.rpc('finalize_paid_collab', {
      p_collab_id: collab.id,
      p_creator_earned: amounts?.creatorPayout ?? collab.creator_payout,
    })
    if (error) {
      return {
        ok: false,
        paymentStatus: collab.payment_status,
        error: error.message,
      }
    }
    return {
      ok: true,
      completed: completed === true,
      paymentStatus: collab.payment_status,
    }
  }

  if (!collab.stripe_payment_intent_id) {
    await updateCollab(admin, collab.id, {
      payment_status: 'capture_failed',
      payment_failure_reason: 'No PaymentIntent is recorded for this collab.',
    })
    return { ok: false, paymentStatus: 'capture_failed', error: 'The payment is not secured.' }
  }

  const captureAmount = amounts?.captureAmount ?? collab.agreed_rate
  const creatorPayout = amounts?.creatorPayout ?? collab.creator_payout

  let intent: Stripe.PaymentIntent
  try {
    intent = await stripe.paymentIntents.retrieve(collab.stripe_payment_intent_id)
    if (intent.status === 'requires_capture') {
      await updateCollab(admin, collab.id, {
        payment_status: 'capture_pending',
        payment_failure_reason: null,
      })

      intent = await stripe.paymentIntents.capture(
        collab.stripe_payment_intent_id,
        captureAmount === collab.agreed_rate ? {} : { amount_to_capture: captureAmount },
        { idempotencyKey: `collab:${collab.id}:capture:${captureAmount}` },
      )
    }

    if (intent.status !== 'succeeded') {
      const paymentStatus = paymentStatusFromIntent(intent)
      const error = `PaymentIntent cannot be captured from status ${intent.status}.`
      await updateCollab(admin, collab.id, {
        payment_status: paymentStatus,
        payment_failure_reason: error,
      })
      return { ok: false, paymentStatus, error }
    }

    await updateCollab(admin, collab.id, {
      payment_status: 'captured',
      captured_at: new Date().toISOString(),
      payment_failure_reason: null,
    })
  } catch (error) {
    const message = errorMessage(error)
    await updateCollab(admin, collab.id, {
      payment_status: 'capture_failed',
      payment_failure_reason: message,
    })
    return { ok: false, paymentStatus: 'capture_failed', error: message }
  }

  const { data: creator } = await admin.from('creator_profiles')
    .select('stripe_connect_id')
    .eq('id', collab.creator_id)
    .single()

  if (!creator?.stripe_connect_id) {
    const error = 'Creator does not have a Stripe Connect payout account.'
    await updateCollab(admin, collab.id, {
      payment_status: 'transfer_failed',
      payment_failure_reason: error,
    })
    return { ok: false, paymentStatus: 'transfer_failed', error }
  }

  try {
    await updateCollab(admin, collab.id, {
      payment_status: 'transfer_pending',
      payment_failure_reason: null,
    })

    const transfer = await stripe.transfers.create({
      amount: creatorPayout,
      currency: 'sgd',
      destination: creator.stripe_connect_id,
      source_transaction: typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined,
      transfer_group: `collab:${collab.id}`,
      metadata: { collab_id: collab.id },
    }, {
      idempotencyKey: `collab:${collab.id}:transfer`,
    })

    await updateCollab(admin, collab.id, {
      stripe_transfer_id: transfer.id,
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      payment_failure_reason: null,
    })

    const { data: completed, error } = await admin.rpc('finalize_paid_collab', {
      p_collab_id: collab.id,
      p_creator_earned: creatorPayout,
    })
    if (error) throw error

    return { ok: true, completed: completed === true, paymentStatus: 'paid' }
  } catch (error) {
    const message = errorMessage(error)
    await updateCollab(admin, collab.id, {
      payment_status: 'transfer_failed',
      payment_failure_reason: message,
    })
    return { ok: false, paymentStatus: 'transfer_failed', error: message }
  }
}

/**
 * Settle a SPLIT dispute resolution explicitly. We capture ONLY the creator's
 * agreed share of the hold; Stripe releases the uncaptured remainder back to the
 * brand atomically as part of the capture call (it is not a deferred auto-void).
 * We then re-read the PaymentIntent and VERIFY the remainder was released
 * (`amount_capturable === 0`, `amount_received === captureAmount`) before
 * transferring the creator's payout, and record the released cents for audit.
 *
 * Using partial capture (rather than full-capture-then-refund) keeps a single
 * idempotent capture, avoids tripping the `charge.refunded`/`refund.updated`
 * webhooks that would clobber payment_status, and never returns Stripe fees on a
 * separately-refunded remainder.
 */
export async function settleSplitDispute(
  admin: AdminClient,
  collab: PaymentCollab,
  amounts: { captureAmount: number; creatorPayout: number },
): Promise<SettlementResult> {
  // Idempotent: an already-settled split just finalizes.
  if (['paid', 'manual_exception'].includes(collab.payment_status)) {
    return captureTransferAndComplete(admin, collab, amounts)
  }
  if (!collab.stripe_payment_intent_id) {
    await updateCollab(admin, collab.id, {
      payment_status: 'capture_failed',
      payment_failure_reason: 'No PaymentIntent is recorded for this collab.',
    })
    return { ok: false, paymentStatus: 'capture_failed', error: 'The payment is not secured.' }
  }

  const captureAmount = amounts.captureAmount
  const releasedRemainder = collab.agreed_rate - captureAmount

  try {
    let intent = await stripe.paymentIntents.retrieve(collab.stripe_payment_intent_id)
    if (intent.status === 'requires_capture') {
      await updateCollab(admin, collab.id, { payment_status: 'capture_pending', payment_failure_reason: null })
      intent = await stripe.paymentIntents.capture(
        collab.stripe_payment_intent_id,
        { amount_to_capture: captureAmount },
        { idempotencyKey: `collab:${collab.id}:capture:${captureAmount}` },
      )
    }

    if (intent.status !== 'succeeded') {
      const paymentStatus = paymentStatusFromIntent(intent)
      const error = `PaymentIntent cannot be captured from status ${intent.status}.`
      await updateCollab(admin, collab.id, { payment_status: paymentStatus, payment_failure_reason: error })
      return { ok: false, paymentStatus, error }
    }

    // Explicitly verify the brand's remainder was released by the capture.
    if (intent.amount_capturable !== 0 || (intent.amount_received ?? 0) !== captureAmount) {
      const error = `Split capture mismatch: captured ${intent.amount_received}, still capturable ${intent.amount_capturable}.`
      await updateCollab(admin, collab.id, { payment_status: 'capture_failed', payment_failure_reason: error })
      return { ok: false, paymentStatus: 'capture_failed', error }
    }

    await updateCollab(admin, collab.id, {
      payment_status: 'captured',
      captured_at: new Date().toISOString(),
      dispute_released_cents: releasedRemainder,
      payment_failure_reason: null,
    })
  } catch (error) {
    const message = errorMessage(error)
    await updateCollab(admin, collab.id, { payment_status: 'capture_failed', payment_failure_reason: message })
    return { ok: false, paymentStatus: 'capture_failed', error: message }
  }

  // Remainder is settled + recorded; hand off to the shared transfer/finalize
  // path (now in 'captured' state, so it skips capture and only transfers).
  return captureTransferAndComplete(admin, collab, amounts)
}

export async function cancelOrRefundPayment(
  admin: AdminClient,
  collab: PaymentCollab,
): Promise<SettlementResult> {
  if (collab.stripe_transfer_id || ['paid', 'manual_exception'].includes(collab.payment_status)) {
    return {
      ok: false,
      paymentStatus: collab.payment_status,
      error: 'Automatic refund blocked because creator payment is already recorded.',
    }
  }

  if (!collab.stripe_payment_intent_id) {
    await updateCollab(admin, collab.id, {
      payment_status: 'cancelled',
      payment_failure_reason: null,
    })
    return { ok: true, paymentStatus: 'cancelled' }
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(collab.stripe_payment_intent_id)

    if (intent.status === 'succeeded') {
      const refund = await stripe.refunds.create({
        payment_intent: intent.id,
        reason: 'requested_by_customer',
        metadata: { collab_id: collab.id },
      }, {
        idempotencyKey: `collab:${collab.id}:refund`,
      })
      const refundStatus = refund.status === 'succeeded'
        ? 'refunded'
        : refund.status === 'pending'
          ? 'refund_pending'
          : 'refund_failed'
      await updateCollab(admin, collab.id, {
        stripe_refund_id: refund.id,
        payment_status: refundStatus,
        refunded_at: refundStatus === 'refunded' ? new Date().toISOString() : null,
        payment_failure_reason: refundStatus === 'refund_failed' ? `Stripe refund status: ${refund.status}` : null,
      })
      if (refundStatus !== 'refunded') {
        return {
          ok: false,
          paymentStatus: refundStatus,
          error: `Stripe refund is ${refund.status}; the collab remains unresolved.`,
        }
      }
      return { ok: true, paymentStatus: refundStatus }
    }

    if (intent.status !== 'canceled') {
      await stripe.paymentIntents.cancel(
        intent.id,
        {},
        { idempotencyKey: `collab:${collab.id}:cancel` },
      )
    }

    await updateCollab(admin, collab.id, {
      payment_status: 'cancelled',
      payment_failure_reason: null,
    })
    return { ok: true, paymentStatus: 'cancelled' }
  } catch (error) {
    const message = errorMessage(error)
    await updateCollab(admin, collab.id, { payment_failure_reason: message })
    return { ok: false, paymentStatus: collab.payment_status, error: message }
  }
}
