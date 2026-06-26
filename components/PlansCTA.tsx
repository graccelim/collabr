'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Check, X, Search, Send, Bookmark, Star, Gift } from 'lucide-react'
import { CURRENCY, PLAN_PRICING, annualPerMonth, betaPlusPrice } from '@/lib/pricing'

// Premium two-tier pricing modal (Collabr Plus Upgrade design). Pro + Plus side by
// side, Annual/Monthly toggle. Beta: Pro shows "Free", Plus shows its full price
// struck through → 50%-off beta price. Drives the real checkout per tier+cycle.
const NAVY = 'linear-gradient(165deg,#0A0C22 0%,#14183C 55%,#0A0C22 100%)'

export default function PlansCTA({
  beta, analyticsSuite = false, label = 'View plans', variant = 'primary',
}: { beta: boolean; analyticsSuite?: boolean; label?: string; variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false)
  const [cycle, setCycle] = useState<'annual' | 'monthly'>('annual')
  const [busy, setBusy] = useState<'pro' | 'plus' | null>(null)

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

  const plusBenefits = [
    { icon: Search, text: 'Search the full creator roster — filter by niche, platform, rate' },
    { icon: Send, text: 'Invite creators directly — no waiting for applications' },
    { icon: Bookmark, text: 'Save & shortlist creators for your next campaign' },
    { icon: Star, text: 'Certified & Connected trust signals while you browse' },
    ...(analyticsSuite ? [{ icon: Sparkles, text: 'Verified performance + campaign analytics with AI recap' }] : []),
  ]

  return (
    <>
      <button type="button" className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'} onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={15} /> {label}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,10,30,.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto',
        }}>
          <div onClick={(e) => e.stopPropagation()} className="resp-1col" style={{
            position: 'relative', width: 'min(940px, 100%)', display: 'grid', gridTemplateColumns: '0.82fr 1fr',
            background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 50px 110px -30px rgba(8,10,40,.6)',
          }}>
            {/* LEFT — navy value panel */}
            <div style={{ position: 'relative', padding: '34px 30px', background: NAVY, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -90, right: -70, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(91,83,224,.4),transparent 70%)', filter: 'blur(20px)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <Sparkles size={15} color="#A9AEE8" />
                  <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9CA2D6', fontWeight: 600 }}>Collabr Plus</span>
                </div>
                <h2 style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.08, letterSpacing: '-.03em', color: '#fff', margin: '0 0 10px' }}>
                  Reach the right creators first.
                </h2>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: '#9CA2D6', margin: '0 0 22px' }}>
                  Stop waiting to be found. Search the roster, filter to your perfect fit, and invite creators directly.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {plusBenefits.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                      <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <b.icon size={15} color="#fff" />
                      </span>
                      <span style={{ color: '#D7DAF2', fontSize: 13, lineHeight: 1.4, paddingTop: 5 }}>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT — pricing */}
            <div style={{ position: 'relative', padding: '30px 28px' }}>
              <button aria-label="Close" onClick={() => setOpen(false)} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(14,16,22,.12)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="#545A66" />
              </button>
              <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.02em', color: '#0E1016' }}>Choose your plan</div>
              <div style={{ fontSize: 13, color: '#8A909C', margin: '3px 0 18px' }}>Your campaigns, applications & payment protection stay free.</div>

              {/* cycle toggle */}
              <div style={{ display: 'inline-flex', background: '#F1F5FC', border: '1px solid rgba(14,16,22,.07)', borderRadius: 11, padding: 4, marginBottom: 18 }}>
                {(['annual', 'monthly'] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setCycle(c)} style={{
                    border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    background: cycle === c ? '#fff' : 'transparent', color: cycle === c ? '#0E1016' : '#8A909C',
                    boxShadow: cycle === c ? '0 2px 6px -2px rgba(14,16,22,.16)' : 'none',
                  }}>{c === 'annual' ? 'Annual · 2 months free' : 'Monthly'}</button>
                ))}
              </div>

              {/* two tiers */}
              <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* PRO */}
                <TierCard
                  name="Pro" tagline="Unlimited barter campaigns"
                  benefits={['Unlimited barter (product-for-content) campaigns', 'Everything on Free']}
                  priceNode={beta
                    ? <Price big="Free" struck={`${CURRENCY}${PLAN_PRICING.pro[cycle]}`} note="during beta" />
                    : <Price big={`${CURRENCY}${PLAN_PRICING.pro[cycle]}`} period={cycle === 'annual' ? '/yr' : '/mo'} note={cycle === 'annual' ? '2 months free' : undefined} />}
                  cta={beta
                    ? <button className="btn-secondary btn-block" disabled style={{ opacity: .7 }}><Gift size={14} style={{ marginRight: 6 }} />Free during beta</button>
                    : <button className="btn-secondary btn-block" onClick={() => checkout('pro')} disabled={busy === 'pro'}>{busy === 'pro' ? 'Opening…' : 'Choose Pro'}</button>}
                />
                {/* PLUS — featured */}
                <TierCard featured
                  name="Plus" tagline="Discover & invite creators"
                  benefits={analyticsSuite
                    ? ['Creator Discovery + invites', 'Verified analytics + campaign ROI', 'Everything in Pro']
                    : ['Creator Discovery + invites', 'Save & shortlist creators', 'Everything in Pro']}
                  priceNode={beta
                    ? <Price big={`${CURRENCY}${betaPlusPrice(cycle)}`} struck={`${CURRENCY}${PLAN_PRICING.plus[cycle]}`} period={cycle === 'annual' ? '/yr' : '/mo'} note="50% off during beta" />
                    : <Price big={`${CURRENCY}${PLAN_PRICING.plus[cycle]}`} period={cycle === 'annual' ? '/yr' : '/mo'} note={cycle === 'annual' ? `≈ ${CURRENCY}${annualPerMonth('plus')}/mo · 2 months free` : undefined} />}
                  cta={<button className="btn-primary btn-block" onClick={() => checkout('plus')} disabled={busy === 'plus'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Sparkles size={14} />{busy === 'plus' ? 'Opening…' : 'Upgrade to Plus'}</button>}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, fontSize: 12, color: '#8A909C' }}>
                <Check size={13} color="#157A55" /> Cancel anytime · saved creators & invites are always kept
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Price({ big, struck, period, note }: { big: string; struck?: string; period?: string; note?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        {struck && <span style={{ textDecoration: 'line-through', color: '#B4B9C4', fontSize: 15 }}>{struck}</span>}
        <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-.03em', color: '#0E1016', lineHeight: 1 }}>{big}</span>
        {period && <span style={{ fontSize: 13, color: '#8A909C' }}>{period}</span>}
      </div>
      {note && <div style={{ fontSize: 12, fontWeight: 600, color: '#157A55', marginTop: 4 }}>{note}</div>}
    </div>
  )
}

function TierCard({ name, tagline, benefits, priceNode, cta, featured = false }: {
  name: string; tagline: string; benefits: string[]; priceNode: React.ReactNode; cta: React.ReactNode; featured?: boolean
}) {
  return (
    <div style={{ position: 'relative', border: featured ? '1.5px solid #5B53E0' : '1px solid rgba(14,16,22,.1)', borderRadius: 14, padding: 16, background: featured ? 'linear-gradient(170deg,#F4F3FF,#fff 60%)' : '#fff', display: 'flex', flexDirection: 'column' }}>
      {featured && <span style={{ position: 'absolute', top: -10, right: 12, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', background: '#5B53E0', padding: '2px 8px', borderRadius: 999 }}>Most popular</span>}
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0E1016' }}>{name}</div>
      <div style={{ fontSize: 12, color: '#8A909C', margin: '2px 0 12px' }}>{tagline}</div>
      {priceNode}
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
