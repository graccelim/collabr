'use client'
import { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import toast from 'react-hot-toast'

interface Props {
  collabId: string
  amountCents: number
  label: string
  onSuccess: () => void
}

export default function StripePaymentButton({ collabId, amountCents, label, onSuccess }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [prAvailable, setPrAvailable] = useState<boolean | null>(null) // null = checking
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      if (!publishableKey) {
        setPrAvailable(false)
        return
      }

      const stripe = await loadStripe(publishableKey)
      if (!stripe || cancelled) return

      // Fetch PaymentIntent client secret
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collab_id: collabId }),
      })
      if (!res.ok) {
        const err = await res.json()
        if (!cancelled) toast.error(err.error || 'Could not initialise payment')
        setPrAvailable(false)
        return
      }
      if (cancelled) return
      const { client_secret } = await res.json()

      // Build Payment Request (Apple Pay / Google Pay)
      const paymentRequest = stripe.paymentRequest({
        country: 'SG',
        currency: 'sgd',
        total: { label, amount: amountCents },
        requestPayerName: false,
        requestPayerEmail: false,
      })

      const canMake = await paymentRequest.canMakePayment()
      if (cancelled) return

      if (!canMake) {
        setPrAvailable(false)
        return
      }

      setPrAvailable(true)

      // Mount the button element
      const elements = stripe.elements()
      const prButton = elements.create('paymentRequestButton', {
        paymentRequest,
        style: { paymentRequestButton: { type: 'buy', theme: 'dark', height: '48px' } },
      })

      if (mountRef.current) {
        prButton.mount(mountRef.current)
      }

      paymentRequest.on('paymentmethod', async (ev) => {
        setPaying(true)
        const { error: confirmError } = await stripe.confirmCardPayment(
          client_secret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        )
        if (confirmError) {
          ev.complete('fail')
          toast.error(confirmError.message || 'Payment failed')
          setPaying(false)
          return
        }
        ev.complete('success')
        toast.success('Payment held — funds release when you confirm the live post')
        onSuccess()
        setPaying(false)
      })
    }

    init()
    return () => { cancelled = true }
  }, [collabId, amountCents, label, onSuccess])

  if (prAvailable === null) {
    return <div className="h-12 rounded-lg bg-gray-100 animate-pulse" />
  }

  if (!prAvailable) {
    return (
      <div className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg px-4 py-3 text-center">
        Apple Pay and Google Pay not available in this browser.{' '}
        <a href="mailto:hello@collabr.sg" className="underline">Contact us</a> to pay by card or bank transfer.
      </div>
    )
  }

  return (
    <div>
      <div ref={mountRef} className={paying ? 'opacity-50 pointer-events-none' : ''} />
      {paying && <p className="text-xs text-gray-500 mt-2 text-center">Processing…</p>}
    </div>
  )
}
