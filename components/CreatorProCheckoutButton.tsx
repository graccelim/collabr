'use client'
import { useState } from 'react'

/**
 * Starts Creator Pro checkout: POSTs to the checkout route and redirects to the
 * Stripe-hosted Checkout URL. Presentational props let it match the card.
 */
export default function CreatorProCheckoutButton({
  plan = 'monthly',
  returnTo,
  children,
  style,
}: {
  plan?: 'monthly' | 'annual'
  returnTo?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function go() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/billing/creator-pro/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: plan, returnTo }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setErr(data.error || 'Could not start checkout.')
    } catch {
      setErr('Could not start checkout.')
    }
    setLoading(false)
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" onClick={go} disabled={loading} style={style}>
        {loading ? 'Starting…' : children}
      </button>
      {err && <span style={{ fontSize: 11.5, color: 'var(--danger, #B23A33)' }}>{err}</span>}
    </span>
  )
}
