'use client'
import { useState } from 'react'
import { Sparkles, Check } from 'lucide-react'
import CreatorProPanel from '@/components/CreatorProPanel'
import StudioDemoCarousel from '@/components/previews/StudioDemoCarousel'

// Locked Creator Studio: lead with a LIVE (sample-data) preview of the product so
// it feels like an experience you want in — not a pricing page. CTA opens the modal.
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
  backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(120% 120% at 100% 0,#000,transparent 70%)', maskImage: 'radial-gradient(120% 120% at 100% 0,#000,transparent 70%)',
}
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"

export default function CreatorProShowcase({ returnTo = '/studio' }: { returnTo?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="gate-wrap" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* hero */}
      <div className="gate-hero" style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '34px 30px 30px', background: 'linear-gradient(150deg,#05060E 0%,#10143A 58%,#05060E 100%)', boxShadow: '0 1px 3px rgba(14,16,22,.04),0 30px 60px -34px rgba(20,30,80,.45)' }}>
        <div style={TEXTURE} />
        <div style={{ position: 'absolute', top: -70, right: -50, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle,rgba(123,115,240,.45),transparent 70%)', filter: 'blur(22px)' }} />
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9D96F7' }}>Creator Pro</span>
          <h1 style={{ fontFamily: NUM, margin: '12px 0 9px', fontSize: 'clamp(25px,3.6vw,32px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.08, color: '#fff' }}>See what is working, and keep more of what you earn.</h1>
          <p style={{ margin: '0 0 22px', fontSize: 14.5, lineHeight: 1.55, color: '#9CA2D6' }}>Connect your accounts and Creator Studio turns your own history into clear next steps: your best formats, your best posting times, and what to make next.</p>
          <button type="button" className="btn-sheen" onClick={() => setOpen(true)}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.985)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#fff', color: '#0A0C22', fontSize: 14.5, fontWeight: 600, padding: '13px 22px', borderRadius: 12, transition: 'transform .18s ease' }}>
            <Sparkles size={15} /> Start your 7 day free trial
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 13, fontSize: 12.5, color: '#9CA2D6' }}>
            <Check size={13} color="#6FCFB2" /> No charge today. Cancel anytime.
          </div>
        </div>
      </div>

      {/* the product, live (sample data), cycles Insights → Content Lab → Collab */}
      <StudioDemoCarousel />

      {/* what else + secondary CTA */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#5A6072', marginBottom: 14 }}>
          Also includes Content Lab, weekly reports, collaboration analysis, and a lower <strong style={{ color: '#157A55' }}>8%</strong> commission.
        </div>
        <button type="button" className="btn-sheen" onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#0A0C22', color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px 22px', borderRadius: 12 }}>
          <Sparkles size={14} /> Unlock Creator Pro
        </button>
      </div>

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
