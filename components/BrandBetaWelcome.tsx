'use client'
import { useEffect, useState } from 'react'
import { Gift, X } from 'lucide-react'

// First-touch welcome for brands during the free-Pro beta. Shown once (dismissal
// remembered in localStorage), gated by isBetaFreePro() on the server. Light card
// with a periodic shine sweep so it stands out. Responsive: text wraps, the close
// button floats in the corner.
const KEY = 'clb_brand_beta_welcome_dismissed'

export default function BrandBetaWelcome() {
  const [show, setShow] = useState(false)
  useEffect(() => { setShow(localStorage.getItem(KEY) !== '1') }, [])
  if (!show) return null

  function dismiss() {
    try { localStorage.setItem(KEY, '1') } catch {}
    setShow(false)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(118deg,#EAF9F1 0%,#FFFFFF 52%,#EEF1FF 100%)', border: '1px solid rgba(20,120,80,.16)', borderRadius: 14, padding: '16px 46px 16px 18px', marginTop: 8, marginBottom: 4, boxShadow: '0 1px 3px rgba(14,16,22,.05),0 20px 40px -34px rgba(20,80,60,.35)', display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      {/* shine sweep */}
      <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', transform: 'skewX(-20deg)', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)', animation: 'clb-shine 4.5s ease-in-out infinite', pointerEvents: 'none' }} />
      <span style={{ position: 'relative', width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'linear-gradient(150deg,#22C083,#12A56B)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -8px rgba(18,165,107,.8)' }}>
        <Gift size={17} color="#fff" />
      </span>
      <div style={{ position: 'relative', minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0E1016', letterSpacing: '-.01em' }}>You&apos;re on Pro, free during launch</div>
        <div style={{ fontSize: 13, color: '#4A5560', lineHeight: 1.5, marginTop: 3 }}>Run unlimited barter campaigns, no card needed. We&apos;ll give you plenty of notice before anything is ever paid.</div>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 999, border: '1px solid rgba(20,30,80,.14)', background: 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <X size={14} color="#7A828F" />
      </button>
    </div>
  )
}
