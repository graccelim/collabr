'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Star, BarChart3, FlaskConical, DollarSign, RotateCcw, ChevronDown, ShieldCheck, X } from 'lucide-react'
import { CURRENCY, CREATOR_PRO_PRICING, creatorProAnnualPerMonth } from '@/lib/pricing'

// Creator Pro upgrade modal (design handoff 7): light modal, navy gridded header,
// five OUTCOME rows (one expandable preview), animated Annual/Monthly toggle, and
// a 7-day-trial CTA. Analytics is the product; AI only explains it — so we sell
// outcomes, not AI. CTA runs our REAL Stripe checkout (spinner → redirect).
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
  backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(120% 120% at 100% 0,#000,transparent 70%)', maskImage: 'radial-gradient(120% 120% at 100% 0,#000,transparent 70%)',
}
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"

const OUTCOMES = [
  { icon: Star, tint: '#ECEBFC', fg: '#5B53E0', title: 'Show brands verified performance', desc: 'Connect TikTok, Instagram and YouTube for real, synced numbers instead of screenshots.' },
  { icon: FlaskConical, tint: '#F1F5FC', fg: '#0A0C22', title: 'Know what to make next', desc: 'Hooks, captions and ideas drawn from your own best content.' },
  { icon: RotateCcw, tint: '#F1F5FC', fg: '#0A0C22', title: 'Your history is always yours', desc: 'Cancel anytime. Studio becomes read only and nothing is ever lost.' },
]

export default function CreatorProPanel({ returnTo = '/studio', onClose }: { returnTo?: string; onClose?: () => void }) {
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual')
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)

  const priceStr = plan === 'annual' ? `${CURRENCY}${creatorProAnnualPerMonth()}` : `${CURRENCY}${CREATOR_PRO_PRICING.monthly}`
  const sub = plan === 'annual'
    ? `7 day free trial · ${CURRENCY}${CREATOR_PRO_PRICING.annual} billed yearly`
    : '7 day free trial · billed monthly after'

  async function upgrade() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/billing/creator-pro/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: plan, returnTo }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) { window.location.href = data.url; return }
      toast.error(data.error || 'Could not start checkout.')
    } catch { toast.error('Could not start checkout.') }
    setBusy(false)
  }

  return (
    <div className="cp-modal" style={{ position: 'relative', width: 472, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 22, boxShadow: '0 50px 120px -30px rgba(8,10,30,.6),0 0 0 1px rgba(14,16,22,.05)', animation: 'cp-modalin .55s cubic-bezier(.16,1,.3,1) both' }}>
      {/* navy gridded header */}
      <div style={{ position: 'relative', padding: '26px 30px 24px', background: 'linear-gradient(150deg,#05060E 0%,#10143A 58%,#05060E 100%)', overflow: 'hidden' }}>
        <div style={TEXTURE} />
        <div style={{ position: 'absolute', top: -60, right: -40, width: 230, height: 230, borderRadius: '50%', background: 'radial-gradient(circle,rgba(123,115,240,.45),transparent 70%)', filter: 'blur(22px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9D96F7' }}>Creator Pro</span>
            {onClose && (
              <button aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={15} color="#fff" />
              </button>
            )}
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', margin: '14px 0 9px', fontSize: 27, fontWeight: 400, letterSpacing: '-.01em', lineHeight: 1.12, color: '#fff' }}>Turn your content history into better decisions.</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#9CA2D6' }}>See what actually works, prove it to brands, and keep more of what you earn.</p>
        </div>
      </div>

      {/* outcomes */}
      <div style={{ padding: '14px 18px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 1, commission (green, financial benefit), top item */}
        <div className="cp-row" style={{ opacity: 0, animation: 'cp-row .5s cubic-bezier(.16,1,.3,1) .06s both', display: 'flex', gap: 13, alignItems: 'center', padding: '13px 12px', borderRadius: 13, background: '#F2FAF6', border: '1px solid rgba(21,122,85,.16)' }}>
          <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: '#157A55', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={17} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0E1016' }}>Keep more of every collaboration</div>
            <div style={{ fontSize: 13, color: '#5A6072', lineHeight: 1.45, marginTop: 2 }}>
              Pay <span style={{ textDecoration: 'line-through', color: '#9AA0AE' }}>10%</span> commission, just <span style={{ color: '#0F5A3E', fontWeight: 600 }}>8%</span> on Pro.
            </div>
          </div>
        </div>

        {/* 2 */}
        <Row {...OUTCOMES[0]} delay={0.12} />

        {/* 3, expandable preview */}
        <div className="cp-row" style={{ opacity: 0, animation: 'cp-row .5s cubic-bezier(.16,1,.3,1) .18s both', borderRadius: 13 }}>
          <button type="button" onClick={() => setExpanded((v) => !v)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', gap: 13, alignItems: 'flex-start', padding: '13px 12px' }}>
            <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: '#F1F5FC', color: '#0A0C22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 size={17} /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: '#0E1016' }}>Understand what actually works</span>
              <span style={{ display: 'block', fontSize: 13, color: '#5A6072', lineHeight: 1.45, marginTop: 2 }}>Insights for every platform, with history that never disappears and clear explanations.</span>
            </span>
            <ChevronDown size={17} color="#9AA0AE" style={{ flex: 'none', marginTop: 9, transition: 'transform .25s ease', transform: expanded ? 'rotate(180deg)' : 'none' }} />
          </button>
          <div style={{ maxHeight: expanded ? 200 : 0, overflow: 'hidden', transition: 'max-height .28s cubic-bezier(.16,1,.3,1)' }}>
            <div style={{ padding: '2px 14px 16px 59px' }}>
              <div style={{ background: '#F7F8FC', border: '1px solid rgba(20,30,80,.07)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9AA0AE' }}>Best posting window</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#157A55' }}>Evening</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 46 }}>
                  {[40, 55, 48, 72, 88, 64].map((h, i) => (
                    <span key={i} style={{ flex: 1, height: `${h}%`, background: i === 3 || i === 4 ? '#5B53E0' : '#D7DAEC', borderRadius: '3px 3px 0 0' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 */}
        <Row {...OUTCOMES[1]} delay={0.24} />

        {/* 5 */}
        <Row {...OUTCOMES[2]} delay={0.3} />
      </div>

      {/* pricing + CTA */}
      <div className="cp-cta-wrap" style={{ padding: '18px 30px 28px' }}>
        <div className="cp-cta-inner" style={{ borderTop: '1px solid rgba(14,16,22,.07)', paddingTop: 20 }}>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F1F3F7', borderRadius: 11, padding: 4, marginBottom: 18 }}>
            <span style={{ position: 'absolute', top: 4, left: 4, width: 'calc(50% - 4px)', height: 'calc(100% - 8px)', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(14,16,22,.12)', transform: plan === 'monthly' ? 'translateX(100%)' : 'translateX(0)', transition: 'transform .32s cubic-bezier(.16,1,.3,1)' }} />
            {(['annual', 'monthly'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPlan(p)} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', cursor: 'pointer', padding: '9px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: plan === p ? '#0E1016' : '#8A909C' }}>{p === 'annual' ? 'Annual' : 'Monthly'}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: p === 'annual' ? '#157A55' : '#B4B9C4' }}>{p === 'annual' ? '2 months free' : 'billed monthly'}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: NUM, fontSize: 40, fontWeight: 700, letterSpacing: '-.03em', color: '#0E1016' }}>{priceStr}</span>
            <span style={{ fontSize: 15, color: '#8A909C', fontWeight: 500 }}>/mo</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#8A909C', marginBottom: 18 }}>{sub}</div>

          <button type="button" className="btn-sheen" onClick={upgrade} disabled={busy}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.985)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            style={{ width: '100%', border: 'none', cursor: 'pointer', background: '#0A0C22', color: '#fff', fontSize: 15, fontWeight: 600, padding: 15, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, transition: 'transform .18s ease, box-shadow .18s ease', boxShadow: '0 14px 30px -14px rgba(10,12,34,.6)' }}>
            {busy && <span style={{ width: 17, height: 17, borderRadius: 999, border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', display: 'inline-block', animation: 'cp-spin .7s linear infinite' }} />}
            {busy ? 'Starting your trial' : 'Start your 7 day free trial'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 13, fontSize: 12.5, color: '#8A909C' }}>
            <ShieldCheck size={14} color="#157A55" /> No charge today · secure checkout via Stripe
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ icon: Icon, tint, fg, title, desc, delay }: { icon: typeof Star; tint: string; fg: string; title: string; desc: string; delay: number }) {
  return (
    <div className="cp-row" style={{ opacity: 0, animation: `cp-row .5s cubic-bezier(.16,1,.3,1) ${delay}s both`, display: 'flex', gap: 13, alignItems: 'flex-start', padding: '13px 12px', borderRadius: 13, transition: 'background .2s', cursor: 'default' }}
      onMouseOver={(e) => { e.currentTarget.style.background = '#F6F7FB' }}
      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}>
      <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: tint, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={17} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0E1016' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#5A6072', lineHeight: 1.45, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )
}
