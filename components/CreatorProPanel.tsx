'use client'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Star, BarChart3, Bot, Coins, FlaskConical, Check, X } from 'lucide-react'
import { CURRENCY, CREATOR_PRO_PRICING, creatorProAnnualPerMonth } from '@/lib/pricing'

// Creator Pro upgrade — two-column (navy value + pricing). Mobile collapses to one
// column and hides the navy benefit list (.plans-hide-mobile). Motion: cycling
// benefit highlight, sliding toggle, count-up price (safety net), sheen CTA.
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

const BENEFITS = [
  { icon: Star, title: 'Become a Connected Creator ⭐', desc: 'Show brands your real, synced performance — win more deals.' },
  { icon: BarChart3, title: 'Creator Studio insights', desc: 'Winning patterns, best posting windows & long-term trends.' },
  { icon: Bot, title: 'Your AI analyst', desc: 'AI explains your own data and what to try next.' },
  { icon: FlaskConical, title: 'Content Lab', desc: 'Hooks & ideas tailored to your best content.' },
  { icon: Coins, title: 'Lower commission', desc: 'Keep more of every paid collab — 8% instead of 10%.' },
]

export default function CreatorProPanel({ returnTo = '/studio', onClose }: { returnTo?: string; onClose?: () => void }) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % BENEFITS.length), 1900)
    return () => clearInterval(id)
  }, [])

  const price = CREATOR_PRO_PRICING[cycle]
  const animated = useCountUp(price)
  const note = cycle === 'annual' ? `≈ ${CURRENCY}${creatorProAnnualPerMonth()}/mo · 2 months free` : '7-day free trial · billed monthly after'

  async function upgrade() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/billing/creator-pro/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: cycle, returnTo }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) { window.location.href = data.url; return }
      toast.error(data.error || 'Could not start checkout.')
    } catch { toast.error('Could not start checkout.') }
    setBusy(false)
  }

  return (
    <div className="resp-1col" style={{
      position: 'relative', width: 'min(880px, 100%)', display: 'grid', gridTemplateColumns: '0.9fr 1fr',
      background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 50px 110px -30px rgba(8,10,40,.6)',
      animation: 'clp-rise-safe .55s cubic-bezier(.16,1,.3,1) both',
    }}>
      {/* LEFT — navy value panel */}
      <div className="plans-navy" style={{ position: 'relative', padding: '30px 28px', background: 'linear-gradient(165deg,#0A0C22 0%,#14183C 55%,#0A0C22 100%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -90, right: -70, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(91,83,224,.4),transparent 70%)', filter: 'blur(20px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={15} color="#A9AEE8" />
            <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9CA2D6', fontWeight: 600 }}>Creator Pro</span>
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.1, letterSpacing: '-.03em', color: '#fff', margin: 0 }}>Turn your analytics into more deals.</h2>
          <div className="plans-hide-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#9CA2D6', margin: '0 0 2px' }}>See what's working, prove it to brands, and keep more of what you earn.</p>
            {BENEFITS.map((b, i) => {
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
      <div className="plans-body" style={{ position: 'relative', padding: '28px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {onClose && (
          <button aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(14,16,22,.12)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
            <X size={16} color="#545A66" />
          </button>
        )}
        <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.02em', color: '#0E1016' }}>Start Creator Pro</div>
        <div style={{ fontSize: 13, color: '#8A909C', margin: '3px 0 16px' }}>Free for 7 days. Cancel anytime — your data is always kept.</div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F1F5FC', border: '1px solid rgba(14,16,22,.07)', borderRadius: 11, padding: 4, marginBottom: 16, maxWidth: 320 }}>
          <span style={{ position: 'absolute', top: 4, left: 4, width: 'calc(50% - 4px)', height: 'calc(100% - 8px)', background: '#fff', border: '1px solid rgba(14,16,22,.1)', borderRadius: 8, boxShadow: '0 2px 6px -2px rgba(14,16,22,.16)', transform: cycle === 'monthly' ? 'translateX(100%)' : 'translateX(0)', transition: 'transform .34s cubic-bezier(.16,1,.3,1)' }} />
          {(['annual', 'monthly'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCycle(c)} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: cycle === c ? '#0E1016' : '#8A909C' }}>{c === 'annual' ? 'Annual' : 'Monthly'}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: c === 'annual' ? '#157A55' : '#B4B9C4' }}>{c === 'annual' ? '2 months free' : 'billed monthly'}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--font-money)', fontWeight: 800, fontSize: 44, letterSpacing: '-.04em', color: '#0E1016', lineHeight: .95, fontVariantNumeric: 'tabular-nums' }}>{CURRENCY}{animated}</span>
          <span style={{ fontSize: 15, color: '#8A909C', fontWeight: 500, marginBottom: 6 }}>{cycle === 'annual' ? '/year' : '/month'}</span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: cycle === 'annual' ? '#157A55' : '#8A909C', marginBottom: 18 }}>{note}</div>

        <button type="button" onClick={upgrade} disabled={busy}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.97)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
          style={{ position: 'relative', overflow: 'hidden', width: '100%', maxWidth: 360, border: 'none', cursor: 'pointer', background: '#0A0C22', color: '#fff', fontSize: 15, fontWeight: 600, padding: 14, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'clp-pulse 3s ease-in-out infinite', transition: 'transform .14s ease' }}>
          <span style={{ position: 'absolute', top: 0, left: 0, width: '34%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)', animation: 'clp-sheen 6s ease-in-out infinite', pointerEvents: 'none' }} />
          <Sparkles size={15} /> {busy ? 'Opening…' : 'Start 7-day free trial'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 12, color: '#8A909C' }}>
          <Check size={13} color="#157A55" /> No charge today · cancel anytime
        </div>
      </div>
    </div>
  )
}
