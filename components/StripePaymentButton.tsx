'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { formatSGD } from '@/lib/utils'
import { flags } from '@/lib/flags'

interface Props {
  collabId: string
  amountCents: number
  label: string
  onSuccess: () => void
}

/**
 * Funding button - redirects to Stripe's own hosted Checkout page.
 *
 * This used to be an embedded Stripe Elements card form inside a modal on
 * collabr's own page. That's just as secure under the hood, but visually
 * indistinguishable from a phishing form to a brand who doesn't know collabr
 * yet - a card field on some unfamiliar site's own page reads as suspicious
 * regardless of how it's built. Redirecting to Stripe's own checkout.stripe.com
 * page inherits Stripe's recognizable branding instead, which matters a lot
 * more for cold-outreach brands than for people who already trust the product.
 *
 * Escrow semantics are unchanged - the underlying PaymentIntent still uses
 * manual capture, so money is authorized now and only captured on live-post
 * approval, exactly as before.
 *
 * Auto-starts when the brand arrives via "Accept & fund" (`?fund=1`), and
 * detects the return trip from Stripe (`?funded=1`) to sync status and show
 * a success state without waiting on the webhook to land first.
 */
export default function StripePaymentButton({ collabId, amountCents, label, onSuccess }: Props) {
  const [starting, setStarting] = useState(false)
  const autoStarted = useRef(false)
  const syncedReturn = useRef(false)
  const amount = formatSGD(amountCents)

  const startPayment = useCallback(async () => {
    if (starting) return
    setStarting(true)
    try {
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collab_id: collabId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not start the payment.')
        setStarting(false)
        return
      }
      if (data.payment_status && data.payment_status !== 'unfunded') {
        toast.success('This collab is already funded.')
        onSuccess()
        setStarting(false)
        return
      }
      if (!data.url) {
        toast.error('Could not start the payment. Please retry.')
        setStarting(false)
        return
      }
      window.location.href = data.url
    } catch (e: any) {
      toast.error(e?.message || 'Could not start the payment.')
      setStarting(false)
    }
  }, [collabId, onSuccess, starting])

  // Auto-start when sent here straight from "Accept & fund".
  useEffect(() => {
    if (autoStarted.current || !flags.escrowLive) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('fund') === '1') {
      autoStarted.current = true
      params.delete('fund')
      const qs = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
      startPayment()
    }
  }, [startPayment])

  // Returning from Stripe's success_url: sync status immediately (the create-
  // intent route re-syncs from Stripe when called again) rather than leaving
  // the page showing "unfunded" until the webhook lands.
  useEffect(() => {
    if (syncedReturn.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('funded') === '1') {
      syncedReturn.current = true
      params.delete('funded')
      const qs = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
      fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collab_id: collabId }),
      })
        .then(() => {
          toast.success('Payment secured, work can begin.')
          onSuccess()
        })
        .catch(() => { /* webhook will reconcile if this sync call fails */ })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!flags.escrowLive) {
    return (
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', padding: '12px 0' }}>
        Payments are temporarily paused. Please check back shortly.
      </p>
    )
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        style={{ justifyContent: 'center', width: '100%' }}
        onClick={startPayment}
        disabled={starting}
      >
        {starting ? 'Opening secure checkout…' : `Fund ${amount} securely`}
      </button>
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', textAlign: 'center', margin: '10px 0 0' }}>
        You'll pay on Stripe's own secure checkout page · your card details never touch collabr.
      </p>
    </>
  )
}
