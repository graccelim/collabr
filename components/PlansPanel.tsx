'use client'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Search, Send, Bookmark, ShieldCheck, BarChart3, Check, X, Gift } from 'lucide-react'
import { CURRENCY, PLAN_PRICING, betaPlusPrice, annualPerMonth } from '@/lib/pricing'

// Two-column pricing modal (desktop): navy value panel + Pro/Plus tier cards.
// Mobile: collapses to one column and HIDES the navy benefit list (via
// .plans-hide-mobile) so pricing is immediately visible. Motion: cycling benefit
// highlight, sliding cycle toggle, count-up prices (safety net), sheen Plus CTA.
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

function Price({ amount, free = false, struck, period, note }: { amount: number; free?: boolean; struck?: string; period?: string; note?: string }) {
  const v = useCountUp(amount)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        {struck && <span style={{ textDecoration: 'line-through', color: '#B4B9C4', fontSize: 15 }}>{struck}</span>}
        <span style={{ fontFamily: 'var(--font-money)', fontWeight: 800, fontSize: 30, letterSpacing: '-.03em', color: '#0E1016', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{free ? 'Free' : `${CURRENCY}${v}`}</span>
        {period && !free && <span style={{ fontSize: 13, color: '#8A909C' }}>{period}</span>}
      </div>
      {note && <div style={{ fontSize: 12, fontWeight: 600, color: '#157A55', marginTop: 4 }}>{note}</div>}
    </div>
  )
}

function TierCard({ name, tagline, benefits, price, cta, featured = false }: {
  name: string; tagline: string; benefits: string[]; price: React.ReactNode; cta: React.ReactNode; featured?: boolean
}) {
  return (
    <div style={{ position: 'relative', border: featured ? '1.5px solid #5B53E0' : '1px solid rgba(14,16,22,.1)', borderRadius: 14, padding: 16, background: featured ? 'linear-gradient(170deg,#F4F3FF,#fff 60%)' : '#fff', display: 'flex', flexDirection: 'column' }}>
      {featured && <span style={{ position: 'absolute', top: -10, right: 12, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', background: '#5B53E0', padding: '2px 8px', borderRadius: 999 }}>Most popular</span>}
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0E1016' }}>{name}</div>
      <div style={{ fontSize: 12, color: '#8A909C', margin: '2px 0 12px' }}>{tagline}</div>
      {price}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        {benefits.map((b, i) => (
          <li key={i} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: '#3A4150', lineHeight: 1.4 }}>
            <Check size={14} color="#157A55" style={{ flexShrink: 0, marginTop: 2 }} /> {b}
          </li>
        ))}
      </ul>
      {cta}
    </div>
  )
}

export default function PlansPanel({
  beta, analyticsSuite = false, onClose,
}: { beta: boolean; analyticsSuite?: boolean; onClose?: () => void }) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly') // monthly first
  const [busy, setBusy] = useState<'pro' | 'plus' | null>(null)
  const [active, setActive] = useState(0)

  const valueBenefits = [
    { icon: Search, title: 'Search the full creator roster', desc: 'Filter by niche, platform, location and rate.' },
    { icon: Send, title: 'Invite creators directly', desc: 'Reach the exact people you want — no waiting.' },
    { icon: Bookmark, title: 'Save & shortlist for later', desc: 'Build a shortlist for your next campaign.' },
    { icon: ShieldCheck, title: 'See trust signals as you browse', desc: 'Certified & Connected badges, inline.' },
    ...(analyticsSuite ? [{ icon: BarChart3, title: 'Verified analytics + campaign ROI', desc: 'Prove performance and measure spend.' }] : []),
  ]
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % valueBenefits.length), 1900)
    return () => clearInterval(id)
  }, [valueBenefits.length])

  async function checkout(tier: 'pro' | 'plus') {
    if (busy) return
    setBusy(tier)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tier, cycle }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) { window.location.href = data.url; return }
      toast.error(data.error || 'Could not start checkout.')
    } catch { toast.error('Could not start checkout.') }
    setBusy(null)
  }

  return (
    <div className="resp-1col" style={{
      position: 'relative', width: 'min(920px, 100%)', display: 'grid', gridTemplateColumns: '0.82fr 1fr',
      background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 50px 110px -30px rgba(8,10,40,.6)',
      animation: 'clp-rise-safe .55s cubic-bezier(.16,1,.3,1) both',
    }}>
      {/* LEFT — navy value panel */}
      <div className="plans-navy" style={{ position: 'relative', padding: '30px 28px', background: 'linear-gradient(165deg,#0A0C22 0%,#14183C 55%,#0A0C22 100%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -90, right: -70, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(91,83,224,.4),transparent 70%)', filter: 'blur(20px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={15} color="#A9AEE8" />
            <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9CA2D6', fontWeight: 600 }}>Collabr Plus</span>
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 25, lineHeight: 1.08, letterSpacing: '-.03em', color: '#fff', margin: 0 }}>Reach the right creators first.</h2>
          <div className="plans-hide-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#9CA2D6', margin: '0 0 2px' }}>Stop waiting to be found. Search the roster, filter to your perfect fit, and invite creators directly.</p>
            {valueBenefits.map((b, i) => {
              const on = i === active
              return (
                <div key={i} style={{
                  display: 'flex', gap: 11, alignItems: 'center', padding: '11px 13px', borderRadius: 13,
                  border: `1px solid ${on ? 'rgba(91,83,224,.55)' : 'rgba(255,255,255,.1)'}`,
                  background: on ? 'rgba(91,83,224,.16)' : 'rgba(255,255,255,.04)', transform: on ? 'translateX(3px)' : 'none',
                  transition: 'background .4s ease, border-color .4s ease, transform .4s ease',
                }}>
                  <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? '#5B53E0' : 'rgba(255,255,255,.08)', transform: on ? 'scale(1.08)' : 'none', transition: 'all .4s ease' }}>
                    <b.icon size={15} color="#fff" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{b.title}</div>
                    <div style={{ color: '#9CA2D6', fontSize: 11.5, lineHeight: 1.35 }}>{b.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* RIGHT — pricing */}
      <div className="plans-body" style={{ position: 'relative', padding: '28px 26px' }}>
        {onClose && (
          <button aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(14,16,22,.12)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
            <X size={16} color="#545A66" />
          </button>
        )}
        <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.02em', color: '#0E1016' }}>Choose your plan</div>
        <div style={{ fontSize: 13, color: '#8A909C', margin: '3px 0 16px' }}>Your campaigns, applications & payment protection stay free.</div>

        {/* cycle toggle */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F1F5FC', border: '1px solid rgba(14,16,22,.07)', borderRadius: 11, padding: 4, marginBottom: 16 }}>
          <span style={{ position: 'absolute', top: 4, left: 4, width: 'calc(50% - 4px)', height: 'calc(100% - 8px)', background: '#fff', border: '1px solid rgba(14,16,22,.1)', borderRadius: 8, boxShadow: '0 2px 6px -2px rgba(14,16,22,.16)', transform: cycle === 'monthly' ? 'translateX(100%)' : 'translateX(0)', transition: 'transform .34s cubic-bezier(.16,1,.3,1)' }} />
          {(['annual', 'monthly'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCycle(c)} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', cursor: 'pointer', padding: '7px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: cycle === c ? '#0E1016' : '#8A909C' }}>{c === 'annual' ? 'Annual' : 'Monthly'}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: c === 'annual' ? '#157A55' : '#B4B9C4' }}>{c === 'annual' ? '2 months free' : 'billed monthly'}</span>
            </button>
          ))}
        </div>

        {/* two tiers */}
        <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TierCard name="Pro" tagline="Unlimited barter campaigns"
            benefits={['Unlimited barter (product-for-content) campaigns', 'Everything on Free']}
            price={beta
              ? <Price amount={0} free struck={`${CURRENCY}${PLAN_PRICING.pro[cycle]}`} note="during beta" />
              : <Price amount={PLAN_PRICING.pro[cycle]} period={cycle === 'annual' ? '/yr' : '/mo'} note={cycle === 'annual' ? '2 months free' : undefined} />}
            cta={beta
              ? <button className="btn-secondary btn-block" disabled style={{ opacity: .7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Gift size={14} />Free during beta</button>
              : <button className="btn-secondary btn-block" onClick={() => checkout('pro')} disabled={busy === 'pro'}>{busy === 'pro' ? 'Opening…' : 'Choose Pro'}</button>}
          />
          <TierCard featured name="Plus" tagline="Discover & invite creators"
            benefits={analyticsSuite ? ['Creator Discovery + invites', 'Verified analytics + campaign ROI', 'Everything in Pro'] : ['Creator Discovery + invites', 'Save & shortlist creators', 'Everything in Pro']}
            price={beta
              ? <Price amount={betaPlusPrice(cycle)} struck={`${CURRENCY}${PLAN_PRICING.plus[cycle]}`} period={cycle === 'annual' ? '/yr' : '/mo'} note="50% off during beta" />
              : <Price amount={PLAN_PRICING.plus[cycle]} period={cycle === 'annual' ? '/yr' : '/mo'} note={cycle === 'annual' ? `≈ ${CURRENCY}${annualPerMonth('plus')}/mo · 2 months free` : undefined} />}
            cta={
              <button className="btn-primary btn-block" onClick={() => checkout('plus')} disabled={busy === 'plus'}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.97)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
                style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, animation: 'clp-pulse 3s ease-in-out infinite', transition: 'transform .14s ease' }}>
                <span style={{ position: 'absolute', top: 0, left: 0, width: '34%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)', animation: 'clp-sheen 6s ease-in-out infinite', pointerEvents: 'none' }} />
                <Sparkles size={14} />{busy === 'plus' ? 'Opening…' : 'Upgrade to Plus'}
              </button>}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, fontSize: 12, color: '#8A909C' }}>
          <Check size={13} color="#157A55" /> Cancel anytime · saved creators & invites are always kept
        </div>
      </div>
    </div>
  )
}
