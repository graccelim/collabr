'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'
import { CURRENCY, PLAN_PRICING } from '@/lib/pricing'

// First-touch welcome for brands during the free-Pro beta. Shown once (dismissal
// remembered in localStorage), gated by isBetaFreePro() on the server. White card,
// navy brand accents, a pronounced shadow + a periodic shine so it stands out.
// Responsive: the price/CTA cluster wraps below the copy on narrow screens.
const KEY = 'clb_brand_beta_welcome_dismissed'
const MONEY = 'var(--font-money, system-ui, sans-serif)'
const DISPLAY = 'var(--font-display, Georgia, serif)'
const MONO = 'var(--font-mono, ui-monospace, monospace)'

export default function BrandBetaWelcome() {
  const [show, setShow] = useState(false)
  useEffect(() => { setShow(localStorage.getItem(KEY) !== '1') }, [])
  if (!show) return null

  function dismiss() {
    try { localStorage.setItem(KEY, '1') } catch {}
    setShow(false)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: '#fff', borderRadius: 16, padding: '18px 20px', marginTop: 8, marginBottom: 4, boxShadow: '0 4px 14px rgba(20,30,80,.10),0 26px 50px -22px rgba(20,30,80,.40)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* shine sweep */}
      <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '32%', transform: 'skewX(-20deg)', background: 'linear-gradient(90deg,transparent,rgba(20,30,80,.06),transparent)', animation: 'clb-shine 4.5s ease-in-out infinite', pointerEvents: 'none' }} />

      {/* left: icon + copy */}
      <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'center', flex: '1 1 340px', minWidth: 0 }}>
        <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: 'linear-gradient(150deg,#2E3A72,#141A3E)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 18px -8px rgba(20,30,80,.7)' }}>
          <Sparkles size={20} color="#fff" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#fff', background: '#1F2A5A', borderRadius: 999, padding: '3px 9px' }}>PRO</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#5C6470' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: '#16A34A' }} /> Free during launch
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0E1016', letterSpacing: '-.01em' }}>
            You&apos;re on Pro <span style={{ color: '#9AA0AE', fontWeight: 500 }}>—</span> <span style={{ fontFamily: DISPLAY, fontStyle: 'italic', color: '#2A3157' }}>free during launch</span>
          </div>
          <div style={{ fontSize: 13, color: '#545A66', lineHeight: 1.5, marginTop: 3 }}>Run unlimited barter campaigns, no card needed. We&apos;ll give you plenty of notice before anything is ever paid.</div>
        </div>
      </div>

      {/* right: price + CTA + dismiss */}
      <div style={{ position: 'relative', display: 'flex', gap: 16, alignItems: 'center', flex: 'none', marginLeft: 'auto' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#A2A8B6' }}>Launch price</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
            <span style={{ fontFamily: MONEY, fontSize: 14, color: '#B4B9C4', textDecoration: 'line-through' }}>{CURRENCY}{PLAN_PRICING.pro.monthly}</span>
            <span style={{ fontFamily: MONEY, fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', color: '#0E1016' }}>{CURRENCY}0</span>
            <span style={{ fontSize: 12, color: '#8A909C' }}>/mo</span>
          </div>
        </div>
        <Link href="/billing" style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', textDecoration: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: '#0A0C22', borderRadius: 10, padding: '10px 15px' }}>What&apos;s included</Link>
        <button type="button" onClick={dismiss} aria-label="Dismiss" style={{ width: 30, height: 30, flex: 'none', borderRadius: 999, border: 'none', background: 'rgba(20,30,80,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={15} color="#7A828F" />
        </button>
      </div>
    </div>
  )
}
