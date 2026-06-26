'use client'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Search, Send, Bookmark, ShieldCheck, BarChart3, Check, X } from 'lucide-react'
import { CURRENCY, PLAN_PRICING, betaPlusPrice, annualPerMonth } from '@/lib/pricing'

// Plus upgrade hero (Collabr Plus Upgrade design): navy value header + pricing
// body. Monthly first. Animated count-up price, sliding toggle, sheen CTA. Beta
// shows full price struck → 50%-off. Used inline on the Discover gate (over the
// blurred roster) and inside the modal.
function useCountUp(target: number, ms = 450): number {
  const [v, setV] = useState(target)
  const prev = useRef(target)
  useEffect(() => {
    const from = prev.current, to = target
    prev.current = target
    if (from === to) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / ms, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(from + (to - from) * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export default function PlusUpgradePanel({
  beta, analyticsSuite = false, onClose,
}: { beta: boolean; analyticsSuite?: boolean; onClose?: () => void }) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly') // monthly first
  const [busy, setBusy] = useState(false)

  const full = PLAN_PRICING.plus[cycle]
  const price = beta ? betaPlusPrice(cycle) : full
  const animated = useCountUp(price)
  const period = cycle === 'annual' ? '/year' : '/month'
  const note = beta
    ? '50% off during beta'
    : cycle === 'annual' ? `≈ ${CURRENCY}${annualPerMonth('plus')}/mo · 2 months free` : 'billed monthly · switch to annual to save'

  async function upgrade() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tier: 'plus', cycle }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) { window.location.href = data.url; return }
      toast.error(data.error || 'Could not start checkout.')
    } catch { toast.error('Could not start checkout.') }
    setBusy(false)
  }

  const benefits = [
    { icon: Search, text: 'Search the full creator roster' },
    { icon: Send, text: 'Invite creators directly' },
    { icon: Bookmark, text: 'Save & shortlist for later' },
    { icon: ShieldCheck, text: 'See trust signals as you browse' },
    ...(analyticsSuite ? [{ icon: BarChart3, text: 'Verified analytics + campaign ROI' }] : []),
  ]

  return (
    <div style={{ width: 'min(460px, 100%)', borderRadius: 22, overflow: 'hidden', background: '#fff', boxShadow: '0 50px 110px -30px rgba(8,10,40,.6)', animation: 'clp-rise .5s cubic-bezier(.16,1,.3,1) both' }}>
      {/* navy header */}
      <div style={{ position: 'relative', padding: '24px 24px 22px', background: 'linear-gradient(165deg,#0A0C22 0%,#14183C 60%,#0A0C22 100%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(91,83,224,.4),transparent 70%)', filter: 'blur(18px)' }} />
        {onClose && (
          <button aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: 999, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
            <X size={15} color="#fff" />
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <Sparkles size={14} color="#A9AEE8" />
            <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9CA2D6', fontWeight: 600 }}>Collabr Plus</span>
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 23, lineHeight: 1.1, letterSpacing: '-.03em', color: '#fff', margin: '0 0 8px' }}>Reach the right creators first.</h2>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: '#9CA2D6', margin: 0 }}>Stop waiting to be found. Upgrade to search, invite and shortlist creators directly.</p>
        </div>
      </div>

      {/* body */}
      <div style={{ padding: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 12 }}>
              <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <b.icon size={15} />
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{b.text}</span>
            </div>
          ))}
        </div>

        {/* toggle — Annual | Monthly, Monthly selected by default */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 5, marginBottom: 18 }}>
          <span style={{ position: 'absolute', top: 5, left: 5, width: 'calc(50% - 5px)', height: 'calc(100% - 10px)', background: '#fff', border: '1px solid var(--line)', borderRadius: 9, boxShadow: '0 2px 6px -2px rgba(14,16,22,.16)', transform: cycle === 'monthly' ? 'translateX(100%)' : 'translateX(0)', transition: 'transform .34s cubic-bezier(.16,1,.3,1)' }} />
          {(['annual', 'monthly'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCycle(c)} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: cycle === c ? 'var(--ink)' : 'var(--ink-soft)' }}>{c === 'annual' ? 'Annual' : 'Monthly'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: c === 'annual' ? 'var(--money-deep)' : 'var(--ink-faint-solid)' }}>{c === 'annual' ? '2 months free' : 'billed monthly'}</span>
            </button>
          ))}
        </div>

        {/* price */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          {beta && <span style={{ textDecoration: 'line-through', color: 'var(--ink-faint-solid)', fontSize: 17, marginBottom: 6 }}>{CURRENCY}{full}</span>}
          <span style={{ fontFamily: 'var(--font-money)', fontWeight: 800, fontSize: 46, letterSpacing: '-.04em', color: 'var(--ink)', lineHeight: .95, fontVariantNumeric: 'tabular-nums' }}>{CURRENCY}{animated}</span>
          <span style={{ fontSize: 15, color: 'var(--ink-soft)', fontWeight: 500, marginBottom: 6 }}>{period}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--money-deep)', marginBottom: 20 }}>{note}</div>

        {/* CTA */}
        <button type="button" onClick={upgrade} disabled={busy} style={{ position: 'relative', overflow: 'hidden', width: '100%', border: 'none', cursor: 'pointer', background: '#0A0C22', color: '#fff', fontSize: 15, fontWeight: 600, padding: 15, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'clp-pulse 3s ease-in-out infinite' }}>
          <span style={{ position: 'absolute', top: 0, left: 0, width: '34%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)', animation: 'clp-sheen 6s ease-in-out infinite', pointerEvents: 'none' }} />
          <Sparkles size={16} /> {busy ? 'Opening…' : 'Upgrade to Plus'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 13, fontSize: 12, color: 'var(--ink-soft)' }}>
          <Check size={13} color="var(--money-deep)" /> Cancel anytime · saved creators are always kept
        </div>
      </div>
    </div>
  )
}
