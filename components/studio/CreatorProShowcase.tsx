'use client'
import { useState } from 'react'
import { Sparkles, Check, ArrowUp, BarChart3, Zap, FileText, LineChart, Coins } from 'lucide-react'
import CreatorProPanel from '@/components/CreatorProPanel'
import StudioDemoCarousel from '@/components/previews/StudioDemoCarousel'

// Locked Creator Studio gate (design: Collabr Creator Pro Gate). A navy hero card
// with the pitch + a "What's included" list (Keep more of every collab is always
// first), then a live sample preview, then a secondary CTA. Opens the modal.
const MONO = "var(--font-mono, ui-monospace, monospace)"
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
  backgroundSize: '30px 30px', WebkitMaskImage: 'radial-gradient(120% 130% at 100% 0,#000,transparent 62%)', maskImage: 'radial-gradient(120% 130% at 100% 0,#000,transparent 62%)',
}

// Keep more of every collab is ALWAYS first.
const INCLUDED: { icon: typeof Coins; label: string; keepMore?: boolean }[] = [
  { icon: Coins, label: 'Keep more of every collab', keepMore: true },
  { icon: BarChart3, label: 'Verified cross-platform analytics' },
  { icon: Zap, label: 'Content Lab, ideas from your best posts' },
  { icon: FileText, label: 'Weekly performance reports' },
  { icon: LineChart, label: 'Collab performance analysis' },
]
// Mobile shows fewer lines.
const INCLUDED_MOBILE: { label: string; keepMore?: boolean }[] = [
  { label: 'Keep more of every collab', keepMore: true },
  { label: 'Verified cross-platform analytics' },
  { label: 'Content Lab & weekly reports' },
]
const KeepMorePill = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', fontFamily: MONO, fontSize: 11.5, background: 'rgba(63,185,132,.12)', border: '1px solid rgba(63,185,132,.3)', borderRadius: 999, padding: '4px 9px' }}>
    <span style={{ color: '#7E83AE', textDecoration: 'line-through' }}>90%</span>
    <ArrowUp size={11} color="#5CD6A0" />
    <span style={{ color: '#5CD6A0', fontWeight: 700 }}>92%</span>
  </span>
)

export default function CreatorProShowcase({ returnTo = '/studio' }: { returnTo?: string }) {
  const [open, setOpen] = useState(false)
  const cta = (label: string, light: boolean) => (
    <button type="button" className="btn-sheen" onClick={() => setOpen(true)}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.985)' }}
      onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: light ? 700 : 600, padding: light ? '15px 26px' : '14px 26px', borderRadius: 13, transition: 'transform .18s ease', background: light ? '#fff' : '#0A0C22', color: light ? '#0A0C22' : '#fff', boxShadow: light ? '0 16px 34px -16px rgba(123,115,240,.7)' : 'none' }}>
      <Sparkles size={16} color={light ? '#5B53E0' : '#A49DF6'} /> {label}
    </button>
  )

  return (
    <div className="gate-wrap" style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* hero card */}
      <div className="gate-procard" style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, padding: '44px 46px', background: 'linear-gradient(150deg,#10132E 0%,#191F4A 52%,#0A0C20 100%)', boxShadow: '0 40px 90px -40px rgba(10,14,45,.7)' }}>
        <div style={TEXTURE} />
        <div style={{ position: 'absolute', top: -110, right: -60, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,rgba(123,115,240,.4),transparent 68%)', filter: 'blur(30px)' }} />

        <div className="resp-1col" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 44 }}>
          {/* pitch */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(150deg,#6B62EC,#4B43C8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -6px rgba(91,83,224,.8)' }}><Sparkles size={16} color="#fff" /></span>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#A49DF6', fontWeight: 500 }}>Creator Pro</span>
            </div>
            <h1 style={{ margin: '0 0 16px', fontFamily: 'var(--font-grotesk)', fontSize: 'clamp(27px,4.3vw,42px)', fontWeight: 700, lineHeight: 1.06, letterSpacing: '-.03em', color: '#fff' }}>Everything you need to grow as a creator.</h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#AEB3DC', maxWidth: 430 }}>Connect your accounts and Creator Studio turns your own history into clear next steps: your best formats, your best posting times, and exactly what to make next.</p>
          </div>

          {/* what's included */}
          <div style={{ background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: '20px 22px 8px', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9094C4', marginBottom: 12 }}>What&apos;s included</div>
            {/* desktop: full list with icon tiles */}
            <div className="hidden md:block">
              {INCLUDED.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderBottom: i < INCLUDED.length - 1 ? '1px solid rgba(255,255,255,.07)' : 'none' }}>
                  <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: it.keepMore ? 'rgba(63,185,132,.18)' : 'rgba(123,115,240,.18)' }}>
                    <it.icon size={16} color={it.keepMore ? '#5CD6A0' : '#A49DF6'} />
                  </span>
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: '#EDEEF8' }}>{it.label}</span>
                  {it.keepMore && <KeepMorePill />}
                </div>
              ))}
            </div>
            {/* mobile: fewer lines, simple checks */}
            <div className="md:hidden">
              {INCLUDED_MOBILE.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: i < INCLUDED_MOBILE.length - 1 ? '1px solid rgba(255,255,255,.07)' : 'none' }}>
                  <Check size={16} color={it.keepMore ? '#5CD6A0' : '#A49DF6'} style={{ flex: 'none' }} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: '#EDEEF8' }}>{it.label}</span>
                  {it.keepMore && <KeepMorePill />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA (below both columns; on mobile this sits after the list) */}
        <div style={{ position: 'relative', marginTop: 28 }}>
          {cta('Start your 7 day free trial', true)}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, fontSize: 13.5, color: '#AEB3DC', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Check size={15} color="#3FB984" /> No charge today, cancel anytime</span>
            <span style={{ color: '#6E72A0' }}>Then S$150/year</span>
          </div>
        </div>
      </div>

      {/* live sample preview (chips + cycling demo) */}
      <StudioDemoCarousel />

      {/* secondary CTA */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>{cta('Unlock Creator Pro', false)}</div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,10,30,.55)', backdropFilter: 'blur(3px)', overflowY: 'auto' }}>
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <CreatorProPanel returnTo={returnTo} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
