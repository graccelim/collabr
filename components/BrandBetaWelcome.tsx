'use client'
import { useEffect, useState } from 'react'
import { Gift, X } from 'lucide-react'

// First-touch welcome for brands during the free-Pro beta. Shown once (dismissal
// remembered in localStorage), gated by isBetaFreePro() on the server. Responsive:
// the text wraps on narrow screens and the close button floats in the corner.
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
    <div style={{ position: 'relative', background: 'linear-gradient(122deg,#0A0C22 0%,#1A2150 62%,#0A0C22 100%)', borderRadius: 14, padding: '16px 46px 16px 18px', marginTop: 8, marginBottom: 4, boxShadow: '0 1px 3px rgba(14,16,22,.06),0 24px 48px -34px rgba(20,30,80,.5)', display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'rgba(122,224,160,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Gift size={17} color="#7AE0A0" />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-.01em' }}>You&apos;re on Pro, free during launch</div>
        <div style={{ fontSize: 13, color: '#C0C5E4', lineHeight: 1.5, marginTop: 3 }}>Run unlimited barter campaigns, no card needed. We&apos;ll give you plenty of notice before anything is ever paid.</div>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 999, border: '1px solid rgba(255,255,255,.16)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <X size={14} color="#9AA0D6" />
      </button>
    </div>
  )
}
