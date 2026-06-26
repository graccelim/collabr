'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Search, Bookmark, Send, BarChart3, Star, Check } from 'lucide-react'
import { CURRENCY, PLAN_PRICING, annualPerMonth } from '@/lib/pricing'

// Enticing, conversion-focused Brand Plus upsell. Discovery benefits always show;
// analytics benefits show only when the Analytics Suite is on. Drives the real
// Plus checkout (tier: 'plus' + cycle).
export default function PlusUpgradeCard({ analyticsSuite = false }: { analyticsSuite?: boolean }) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual')
  const [busy, setBusy] = useState(false)

  async function upgrade() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier: 'plus', cycle }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) { window.location.href = data.url; return }
      toast.error(data.error || 'Could not start checkout.')
    } catch { toast.error('Could not start checkout.') }
    setBusy(false)
  }

  const discovery = [
    { icon: Search, text: 'Search a curated creator roster — filter by niche, platform, location & rate' },
    { icon: Send, text: 'Invite the exact creators you want, directly — no waiting for applications' },
    { icon: Bookmark, text: 'Save and shortlist creators for your next campaign' },
    { icon: Star, text: 'See 🛡️ Collabr Certified & ⭐ Connected signals while you browse' },
  ]
  const analytics = [
    { icon: BarChart3, text: 'Connected performance on creator profiles — real views, engagement & reach' },
    { icon: BarChart3, text: 'Campaign analytics — CPV, CPE, top creators & posts, with an AI recap' },
  ]
  const items = analyticsSuite ? [...discovery, ...analytics] : discovery

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid var(--accent)' }}>
      {/* Premium header */}
      <div style={{
        padding: '18px 20px', color: '#fff',
        background: 'linear-gradient(152deg, #232c57 0%, #0e1538 60%, #05081c 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color="var(--accent-on-dark)" />
          <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 11 }}>collabr Plus</span>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
          Find and reach the right creators — first
        </h2>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, margin: 0 }}>
          Stop waiting to be found. Search the roster, filter to your perfect fit, and invite creators directly
          {analyticsSuite ? ' — then prove ROI with real performance analytics.' : '.'}
        </p>
      </div>

      <div style={{ padding: 20 }}>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 11, margin: '0 0 18px', padding: 0, listStyle: 'none' }}>
          {items.map((b, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--accent-tint)', color: 'var(--accent-deep)' }}>
                <b.icon size={14} />
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45, paddingTop: 3 }}>{b.text}</span>
            </li>
          ))}
        </ul>

        {/* Billing cycle toggle */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 3, marginBottom: 12 }}>
          {(['annual', 'monthly'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCycle(c)}
              style={{
                fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: cycle === c ? 'var(--surface)' : 'transparent',
                color: cycle === c ? 'var(--ink)' : 'var(--ink-soft)',
                boxShadow: cycle === c ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {c === 'annual' ? 'Annual · 2 months free' : 'Monthly'}
            </button>
          ))}
        </div>

        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-money)', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {CURRENCY}{cycle === 'annual' ? PLAN_PRICING.plus.annual : PLAN_PRICING.plus.monthly}
          </span>
          <span style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>/{cycle === 'annual' ? 'year' : 'month'}</span>
          {cycle === 'annual' && (
            <span style={{ fontSize: 12, color: 'var(--money-deep)', fontWeight: 600 }}>
              ≈ {CURRENCY}{annualPerMonth('plus')}/mo · 2 months free
            </span>
          )}
        </div>

        <button type="button" className="btn-primary btn-block" onClick={upgrade} disabled={busy}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Sparkles size={15} /> {busy ? 'Opening…' : 'Upgrade to Plus'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Check size={12} /> Cancel anytime · saved creators & invites are always kept
        </p>
      </div>
    </div>
  )
}
