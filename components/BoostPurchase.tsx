'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

const OPTIONS = [
  { type: 'per_app' as const, days: '7 days', price: 'S$4' },
  { type: 'monthly' as const, days: '30 days', price: 'S$20' },
]

/**
 * Minimal boost checkout: a short explanation + two price options. Picking one
 * goes straight to Stripe Checkout. No marketing hero — boost is a small,
 * optional growth tool, reached only from the BoostHint or a direct URL.
 */
export default function BoostPurchase({ initialBoostUntil, preview = false }: { initialBoostUntil: string | null; preview?: boolean }) {
  const params = useSearchParams()
  const [loading, setLoading] = useState<'monthly' | 'per_app' | null>(null)
  const isActive = initialBoostUntil ? new Date(initialBoostUntil).getTime() > Date.now() : false
  const daysLeft = isActive
    ? Math.max(1, Math.ceil((new Date(initialBoostUntil!).getTime() - Date.now()) / 86_400_000))
    : 0

  useEffect(() => {
    if (params.get('success')) toast.success('Payment received — your boost is now active.')
    else if (params.get('canceled')) toast('Checkout canceled — no charge was made.')
  }, [params])

  async function purchase(type: 'monthly' | 'per_app') {
    if (preview) {
      toast('Preview mode — checkout is disabled. No charge was made.')
      return
    }
    setLoading(type)
    const res = await fetch('/api/payments/boost-creator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    const data = await res.json()
    if (!res.ok || !data.url) {
      toast.error(data.error || 'Could not start checkout')
      setLoading(null)
      return
    }
    window.location.href = data.url // → Stripe Checkout; activates via webhook
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Boost your profile</h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6, lineHeight: 1.55 }}>
        Appear higher in applicant lists for a few days. It&rsquo;s a clearly-labelled sponsored
        placement only — it never changes your ratings, reliability or match quality.
      </p>

      {preview && (
        <div className="card" style={{ padding: 12, marginTop: 16, background: 'var(--warn-tint)', border: '1px solid var(--warn)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn-deep)' }}>Preview mode</span>
          <span style={{ fontSize: 12.5, color: 'var(--warn-deep)', marginLeft: 6 }}>Checkout is disabled — no Stripe session is created.</span>
        </div>
      )}

      {isActive && !preview && (
        <div className="card" style={{ padding: 14, marginTop: 18, background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-2, var(--accent-tint))' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent-deep)' }}>Boosted · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
          <span style={{ fontSize: 13, color: 'var(--accent)', marginLeft: 6 }}>Choose an option below to extend.</span>
        </div>
      )}

      <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
        {OPTIONS.map(o => (
          <div key={o.type} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{o.days}</span>
            <span className="mono-num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{o.price}</span>
            <button
              onClick={() => purchase(o.type)}
              disabled={!!loading || preview}
              className="btn-primary btn-block"
              style={{ marginTop: 12 }}
            >{preview ? 'Preview only' : loading === o.type ? 'Redirecting…' : isActive ? 'Extend' : 'Boost'}</button>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 16 }}>
        Secure payment via Stripe. Your boost activates only after payment succeeds.
      </p>
    </div>
  )
}
