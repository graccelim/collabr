'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Zap, ArrowUp, TrendingUp, Eye, ShieldCheck } from 'lucide-react'

const OPTIONS = [
  { type: 'per_app' as const, days: '7 days', price: 'S$4', tag: 'Quick boost' },
  { type: 'monthly' as const, days: '30 days', price: 'S$20', tag: 'Popular', featured: true },
]

const BENEFITS = [
  { icon: ArrowUp, color: 'var(--money)', tint: 'var(--money-tint)', text: 'Jump to the top of applicant lists brands review first' },
  { icon: Eye, color: 'var(--accent)', tint: 'var(--accent-tint)', text: 'Get seen by brands browsing for creators like you' },
  { icon: ShieldCheck, color: 'var(--warn)', tint: 'var(--warn-tint)', text: 'Clearly labelled — never touches your ratings or match quality' },
]

/**
 * Minimal boost checkout: a short explanation + two price options. Picking one
 * goes straight to Stripe Checkout. No marketing hero — boost is a small,
 * optional growth tool, reached only from the BoostHint or a direct URL.
 */
export default function BoostPurchase({ initialBoostUntil, preview = false, returnTo }: { initialBoostUntil: string | null; preview?: boolean; returnTo?: string }) {
  const params = useSearchParams()
  const [loading, setLoading] = useState<'monthly' | 'per_app' | null>(null)
  const isActive = initialBoostUntil ? new Date(initialBoostUntil).getTime() > Date.now() : false
  const daysLeft = isActive
    ? Math.max(1, Math.ceil((new Date(initialBoostUntil!).getTime() - Date.now()) / 86_400_000))
    : 0

  useEffect(() => {
    const r = params.get('boost')
    if (r === 'success') toast.success('Payment received — your boost is now active.')
    else if (r === 'canceled') toast('Checkout canceled — no charge was made.')
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
      body: JSON.stringify({ type, returnTo }),
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: 'linear-gradient(140deg, var(--accent), var(--accent-deep))', color: '#fff',
          boxShadow: '0 4px 14px -4px var(--accent)',
        }}>
          <Zap size={20} />
        </span>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>Boost your profile</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--money)', marginTop: 3 }}>
            <TrendingUp size={13} /> Get discovered faster
          </span>
        </div>
      </div>

      {/* What you get — colour-coded so the value lands at a glance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        {BENEFITS.map(b => (
          <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: b.tint, color: b.color }}>
              <b.icon size={15} />
            </span>
            <span style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.4 }}>{b.text}</span>
          </div>
        ))}
      </div>

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
          <div key={o.type} className="card" style={{
            padding: 20, display: 'flex', flexDirection: 'column', gap: 4, position: 'relative',
            border: o.featured ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            background: o.featured ? 'linear-gradient(160deg, var(--accent-tint) 0%, var(--surface) 55%)' : 'var(--surface)',
          }}>
            <span style={{
              alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, letterSpacing: '.02em',
              textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999,
              background: o.featured ? 'var(--accent)' : 'var(--surface-2)',
              color: o.featured ? '#fff' : 'var(--ink-soft)',
            }}>{o.tag}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>{o.days}</span>
            <span className="mono-num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{o.price}</span>
            <button
              onClick={() => purchase(o.type)}
              disabled={!!loading || preview}
              className={o.featured ? 'btn-primary btn-block' : 'btn-secondary btn-block'}
              style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {preview ? 'Preview only' : loading === o.type ? 'Redirecting…' : (
                <>{isActive ? 'Extend' : 'Boost'} <ArrowUp size={15} /></>
              )}
            </button>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 16 }}>
        Secure payment via Stripe. Your boost activates only after payment succeeds.
      </p>
    </div>
  )
}
