'use client'
import { useState } from 'react'
import { Search, SlidersHorizontal, Send, Bookmark, ShieldCheck, Sparkles, Check } from 'lucide-react'
import PlansPanel from '@/components/PlansPanel'

// Premium benefits showcase for the Brand Plus (Creator Discovery) gate — used on
// the Discover Creators and Invites pages. Shows the value, then a CTA that opens
// the plans modal (rather than dropping the modal inline).
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
  backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(120% 120% at 100% 0,#000,transparent 70%)', maskImage: 'radial-gradient(120% 120% at 100% 0,#000,transparent 70%)',
}
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }

const BENEFITS = [
  { icon: Search, title: 'Creator Discovery', desc: 'Search the full creator roster and find your perfect fit in minutes.' },
  { icon: SlidersHorizontal, title: 'Advanced search & filters', desc: 'Filter by niche, platform, location, rate and availability.' },
  { icon: Send, title: 'Invite creators directly', desc: 'Reach the exact people you want — no waiting to be found.' },
  { icon: Bookmark, title: 'Save & shortlist', desc: 'Build shortlists for your next campaign and keep them.' },
  { icon: ShieldCheck, title: 'See trust signals', desc: 'Collabr Certified & Connected badges, inline as you browse.' },
]

export default function PlansShowcase({
  beta, heading, sub, label = 'Unlock Discovery',
}: { beta: boolean; heading: string; sub: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* hero band + CTA */}
      <div style={{ ...CARD, borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(14,16,22,.04),0 22px 48px -30px rgba(20,30,80,.32)' }}>
        <div style={{ position: 'relative', padding: '34px 32px 30px', background: 'linear-gradient(150deg,#05060E 0%,#10143A 58%,#05060E 100%)', overflow: 'hidden' }}>
          <div style={TEXTURE} />
          <div style={{ position: 'absolute', top: -70, right: -50, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle,rgba(123,115,240,.42),transparent 70%)', filter: 'blur(22px)' }} />
          <div style={{ position: 'relative', maxWidth: 580 }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9D96F7' }}>Collabr Plus</span>
            <h1 style={{ fontFamily: NUM, margin: '12px 0 9px', fontSize: 'clamp(24px,3.4vw,30px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1, color: '#fff' }}>{heading}</h1>
            <p style={{ margin: '0 0 22px', fontSize: 14.5, lineHeight: 1.55, color: '#9CA2D6' }}>{sub}</p>
            <button type="button" className="btn-sheen" onClick={() => setOpen(true)}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.985)' }}
              onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#fff', color: '#0A0C22', fontSize: 14.5, fontWeight: 600, padding: '13px 22px', borderRadius: 12, transition: 'transform .18s ease' }}>
              <Sparkles size={15} /> {label}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 13, fontSize: 12.5, color: '#9CA2D6' }}>
              <Check size={13} color="#6FCFB2" /> Everything in Brand Pro included · cancel anytime
            </div>
          </div>
        </div>
      </div>

      {/* benefits grid */}
      <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {BENEFITS.map((b, i) => (
          <div key={i} style={{ ...CARD, padding: 18, display: 'flex', gap: 13, alignItems: 'flex-start' }}>
            <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5FC', color: '#0A0C22' }}>
              <b.icon size={17} color="#0A0C22" />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0E1016' }}>{b.title}</div>
              <div style={{ fontSize: 13, color: '#5A6072', lineHeight: 1.45, marginTop: 2 }}>{b.desc}</div>
            </div>
          </div>
        ))}
        <div style={{ ...CARD, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flexDirection: 'column', gap: 10, borderStyle: 'dashed' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0E1016' }}>Ready to find your creators?</div>
          <button type="button" className="btn-sheen" onClick={() => setOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', background: '#0A0C22', color: '#fff', fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 11 }}>
            <Sparkles size={14} /> See plans
          </button>
        </div>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,10,30,.55)', backdropFilter: 'blur(3px)', overflowY: 'auto' }}>
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <PlansPanel beta={beta} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
