'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js'
import toast from 'react-hot-toast'
import { formatSGD } from '@/lib/utils'

interface Props {
  collabId: string
  amountCents: number
  label: string
  onSuccess: () => void
}

// Load Stripe once per page, lazily.
let stripePromise: Promise<Stripe | null> | null = null
function getStripe() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  if (!stripePromise) stripePromise = loadStripe(key)
  return stripePromise
}

/**
 * Funding button + card payment modal.
 *
 * Click "Fund …" → we create (or reuse) the manual-capture PaymentIntent, open a
 * modal with Stripe's Payment Element (card + any available wallets), and confirm
 * on "Pay". Works on every desktop browser — no reliance on Apple/Google Pay.
 *
 * After a successful authorization we re-hit create-intent, which calls
 * persistIntentTruth and flips the collab to `funded` immediately, so the brand
 * isn't left on "authorizing" while waiting for the webhook (important in dev).
 *
 * Auto-opens when the brand arrives via "Accept & fund" (`?fund=1`).
 */
export default function StripePaymentButton({ collabId, amountCents, label, onSuccess }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [starting, setStarting] = useState(false)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [paying, setPaying] = useState(false)

  const stripeRef = useRef<Stripe | null>(null)
  const elementsRef = useRef<StripeElements | null>(null)
  const clientSecretRef = useRef<string | null>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const autoStarted = useRef(false)

  const hasKey = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  const amount = formatSGD(amountCents)

  const startPayment = useCallback(async () => {
    if (starting || paying || open) return
    setStarting(true)
    try {
      const sp = getStripe()
      if (!sp) {
        toast.error('Payments are not configured. Please contact support.')
        return
      }
      const stripe = await sp
      if (!stripe) {
        toast.error('Could not load the payment form. Please retry.')
        return
      }
      stripeRef.current = stripe

      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collab_id: collabId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not start the payment.')
        return
      }
      if (data.payment_status === 'funded') {
        toast.success('This collab is already funded.')
        onSuccess()
        return
      }
      if (!data.client_secret) {
        toast.error('Could not start the payment. Please retry.')
        return
      }
      clientSecretRef.current = data.client_secret
      setReady(false)
      setOpen(true)
    } catch (e: any) {
      toast.error(e?.message || 'Could not start the payment.')
    } finally {
      setStarting(false)
    }
  }, [collabId, onSuccess, starting, paying, open])

  // Auto-open when the brand was sent here straight from "Accept & fund".
  useEffect(() => {
    if (autoStarted.current) return
    if (searchParams.get('fund') === '1' && hasKey) {
      autoStarted.current = true
      // Strip the flag so a refresh doesn't reopen the modal.
      router.replace(pathname, { scroll: false })
      startPayment()
    }
  }, [searchParams, hasKey, pathname, router, startPayment])

  // Mount the Payment Element once the modal is open and we have a client secret.
  useEffect(() => {
    if (!open || !stripeRef.current || !clientSecretRef.current || !mountRef.current) return
    const elements = stripeRef.current.elements({
      clientSecret: clientSecretRef.current,
      appearance: {
        theme: 'stripe',
        variables: { colorPrimary: '#000435', borderRadius: '10px', fontFamily: 'inherit' },
      },
    })
    const paymentEl = elements.create('payment', { layout: 'tabs' })
    paymentEl.on('ready', () => setReady(true))
    paymentEl.mount(mountRef.current)
    elementsRef.current = elements
    return () => {
      paymentEl.unmount()
      elementsRef.current = null
    }
  }, [open])

  async function pay() {
    const stripe = stripeRef.current
    const elements = elementsRef.current
    if (!stripe || !elements) return
    setPaying(true)
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.href },
      })
      if (error) {
        toast.error(error.message || 'Payment failed. Please check your card details.')
        return
      }
      // Authorized (manual capture → requires_capture). Force the collab to
      // reflect `funded` now instead of waiting on the webhook.
      try {
        await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collab_id: collabId }),
        })
      } catch { /* webhook will reconcile if this sync call fails */ }
      toast.success('Payment secured — work can begin.')
      setOpen(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e?.message || 'Payment failed. Please retry.')
    } finally {
      setPaying(false)
    }
  }

  if (!hasKey) {
    return (
      <div className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg px-4 py-3 text-center">
        Card payments are not available right now.{' '}
        <a href="mailto:joincollabr@gmail.com" className="underline">Contact us</a> to fund this collab.
      </div>
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

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Secure payment"
          onClick={() => !paying && setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(10,12,34,.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'clamp(20px,3vw,28px)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', margin: 0 }}>
                Secure {amount}
              </h3>
              <button
                type="button"
                onClick={() => !paying && setOpen(false)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: 'var(--ink-faint-solid)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 18px' }}>
              Your card is held by collabr, not the creator. The money only moves once you approve the live post.
            </p>

            <div ref={mountRef} style={{ minHeight: 200 }} />
            {!ready && (
              <div style={{ height: 200, borderRadius: 10, background: 'var(--paper-2)' }} className="animate-pulse" />
            )}

            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              style={{ justifyContent: 'center', width: '100%', marginTop: 18 }}
              onClick={pay}
              disabled={!ready || paying}
            >
              {paying ? 'Processing…' : `Pay ${amount}`}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ justifyContent: 'center', width: '100%', marginTop: 8 }}
              onClick={() => !paying && setOpen(false)}
              disabled={paying}
            >
              Cancel
            </button>
            <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', textAlign: 'center', margin: '12px 0 0' }}>
              Powered by Stripe · your card details never touch collabr.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
