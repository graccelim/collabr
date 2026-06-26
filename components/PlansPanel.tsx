'use client'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Search, Send, Bookmark, ShieldCheck, BarChart3, Repeat, Check, X, Gift } from 'lucide-react'
import { CURRENCY, PLAN_PRICING, betaPlusPrice, annualPerMonth } from '@/lib/pricing'

// Clean, single-column, non-scrollable pricing modal (Collabr Plus design). Shows
// BOTH tiers via a Pro/Plus selector (one look — no scrolling). Motion: cycling
// benefit highlight, sliding toggles, count-up price (safety net), sheen CTA.
function useCountUp(target: number, ms = 480): number {
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
    const safe = setTimeout(() => setV(to), 600)
    return () => { cancelAnimationFrame(raf); clearTimeout(safe) }
  }, [target, ms])
  return v
}

const PLUS_BENEFITS = [
  { icon: Search, title: 'Search the full creator roster', desc: 'Filter by niche, platform, location and rate.' },
  { icon: Send, title: 'Invite creators directly', desc: 'Reach the exact people you want — no waiting.' },
  { icon: Bookmark, title: 'Save & shortlist for later', desc: 'Build a shortlist for your next campaign.' },
  { icon: ShieldCheck, title: 'See trust signals as you browse', desc: 'Certified & Connected badges, inline.' },
]
const PRO_BENEFITS = [
  { icon: Repeat, title: 'Unlimited barter campaigns', desc: 'Product-for-content collabs, no limits.' },
  { icon: Check, title: 'Everything on Free', desc: 'Paid campaigns, escrow, reviews & disputes.' },
]

export default function PlansPanel({
  beta, analyticsSuite = false, onClose,
}: { beta: boolean; analyticsSuite?: boolean; onClose?: () => void }) {
  const [tier, setTier] = useState<'pro' | 'plus'>('plus')
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)

  const benefits = tier === 'plus'
    ? [...PLUS_BENEFITS, ...(analyticsSuite ? [{ icon: BarChart3, title: 'Verified analytics + campaign ROI', desc: 'Prove performance and measure spend.' }] : [])]
    : PRO_BENEFITS
  useEffect(() => { setActive(0) }, [tier])
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % benefits.length), 1900)
    return () => clearInterval(id)
  }, [benefits.length])

  // Pricing for the selected tier + cycle.
  const full = PLAN_PRICING[tier][cycle]
  const proFreeBeta = tier === 'pro' && beta
  const amount = tier === 'plus' && beta ? betaPlusPrice(cycle) : full
  const animated = useCountUp(amount)
  const struck = (tier === 'plus' && beta) || proFreeBeta ? `${CURRENCY}${full}` : null
  const note = proFreeBeta ? 'during beta'
    : tier === 'plus' && beta ? '50% off during beta'
    : cycle === 'annual'
      ? (tier === 'plus' ? `≈ ${CURRENCY}${annualPerMonth('plus')}/mo · 2 months free` : '2 months free')
      : 'billed monthly · switch to annual to save'
  const descriptor = tier === 'plus' ? 'Creator Discovery, invites & shortlists' : 'Unlimited barter campaigns'

  async function checkout() {
    if (busy || proFreeBeta) return
    setBusy(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tier, cycle }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) { window.location.href = data.url; return }
      toast.error(data.error || 'Could not start checkout.')
    } catch { toast.error('Could not start checkout.') }
    setBusy(false)
  }

  const segWrap = { position: 'relative' as const, display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F1F5FC', border: '1px solid rgba(14,16,22,.07)', borderRadius: 11, padding: 4 }
  const segInd = (right: boolean) => ({ position: 'absolute' as const, top: 4, left: 4, width: 'calc(50% - 4px)', height: 'calc(100% - 8px)', background: '#fff', border: '1px solid rgba(14,16,22,.1)', borderRadius: 8, boxShadow: '0 2px 6px -2px rgba(14,16,22,.16)', transform: right ? 'translateX(100%)' : 'translateX(0)', transition: 'transform .34s cubic-bezier(.16,1,.3,1)' })
  const segBtn = { position: 'relative' as const, zIndex: 1, border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 6px', fontSize: 13, fontWeight: 600 }

  return (
    <div style={{
      position: 'relative', width: 'min(460px, 100%)', background: '#fff', borderRadius: 22, overflow: 'hidden',
      boxShadow: '0 50px 110px -30px rgba(8,10,40,.6)', animation: 'clp-rise-safe .55s cubic-bezier(.16,1,.3,1) both',
    }}>
      {/* navy header */}
      <div style={{ position: 'relative', padding: '22px 24px 20px', background: 'linear-gradient(165deg,#0A0C22 0%,#14183C 60%,#0A0C22 100%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(91,83,224,.4),transparent 70%)', filter: 'blur(18px)' }} />
        {onClose && (
          <button aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: 999, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
            <X size={15} color="#fff" />
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Sparkles size={14} color="#A9AEE8" />
            <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9CA2D6', fontWeight: 600 }}>Collabr Plus</span>
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.1, letterSpacing: '-.03em', color: '#fff', margin: '0 0 6px' }}>Reach the right creators first.</h2>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: '#9CA2D6', margin: 0 }}>Upgrade to search, invite and shortlist creators for your campaigns.</p>
        </div>
      </div>

      {/* body */}
      <div style={{ padding: 20 }}>
        {/* benefit rows (cycling) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {benefits.map((b, i) => {
            const on = i === active
            return (
              <div key={`${tier}-${i}`} style={{
                display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12,
                border: `1px solid ${on ? 'rgba(91,83,224,.55)' : 'rgba(14,16,22,.08)'}`,
                background: on ? 'rgba(91,83,224,.10)' : '#fff', transform: on ? 'translateX(3px)' : 'none',
                transition: 'background .4s ease, border-color .4s ease, transform .4s ease',
              }}>
                <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? '#5B53E0' : '#F1F5FC', transform: on ? 'scale(1.08)' : 'none', transition: 'all .4s ease' }}>
                  <b.icon size={15} color={on ? '#fff' : '#0A0C22'} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#0E1016', fontWeight: 600, fontSize: 13 }}>{b.title}</div>
                  <div style={{ color: '#8A909C', fontSize: 11.5, lineHeight: 1.35 }}>{b.desc}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* tier selector */}
        <div style={{ ...segWrap, marginBottom: 8 }}>
          <span style={segInd(tier === 'plus')} />
          {(['pro', 'plus'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTier(t)} style={{ ...segBtn, color: tier === t ? '#0E1016' : '#8A909C' }}>
              {t === 'pro' ? 'Pro' : 'Plus'}{t === 'plus' && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: '#5B53E0', background: 'rgba(91,83,224,.12)', padding: '1px 5px', borderRadius: 999 }}>POPULAR</span>}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#8A909C', marginBottom: 12 }}>{descriptor}</div>

        {/* cycle toggle */}
        <div style={{ ...segWrap, marginBottom: 16 }}>
          <span style={segInd(cycle === 'monthly')} />
          {(['annual', 'monthly'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCycle(c)} style={{ ...segBtn, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: cycle === c ? '#0E1016' : '#8A909C' }}>
              <span>{c === 'annual' ? 'Annual' : 'Monthly'}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: c === 'annual' ? '#157A55' : '#B4B9C4' }}>{c === 'annual' ? '2 months free' : 'billed monthly'}</span>
            </button>
          ))}
        </div>

        {/* price */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
          {struck && <span style={{ textDecoration: 'line-through', color: '#B4B9C4', fontSize: 16, marginBottom: 6 }}>{struck}</span>}
          <span style={{ fontFamily: 'var(--font-money)', fontWeight: 800, fontSize: 42, letterSpacing: '-.04em', color: '#0E1016', lineHeight: .95, fontVariantNumeric: 'tabular-nums' }}>{proFreeBeta ? 'Free' : `${CURRENCY}${animated}`}</span>
          {!proFreeBeta && <span style={{ fontSize: 14, color: '#8A909C', fontWeight: 500, marginBottom: 5 }}>{cycle === 'annual' ? '/year' : '/month'}</span>}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: cycle === 'annual' && !beta ? '#157A55' : (beta ? '#157A55' : '#8A909C'), marginBottom: 16 }}>{note}</div>

        {/* CTA */}
        {proFreeBeta ? (
          <button className="btn-secondary btn-block" disabled style={{ opacity: .75, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Gift size={14} /> Free during beta</button>
        ) : (
          <button type="button" onClick={checkout} disabled={busy}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.97)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            style={{ position: 'relative', overflow: 'hidden', width: '100%', border: 'none', cursor: 'pointer', background: '#0A0C22', color: '#fff', fontSize: 15, fontWeight: 600, padding: 14, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'clp-pulse 3s ease-in-out infinite', transition: 'transform .14s ease' }}>
            <span style={{ position: 'absolute', top: 0, left: 0, width: '34%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)', animation: 'clp-sheen 6s ease-in-out infinite', pointerEvents: 'none' }} />
            <Sparkles size={15} /> {busy ? 'Opening…' : tier === 'plus' ? 'Upgrade to Plus' : 'Choose Pro'}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, fontSize: 12, color: '#8A909C' }}>
          <Check size={13} color="#157A55" /> Cancel anytime · saved creators are always kept
        </div>
      </div>
    </div>
  )
}
