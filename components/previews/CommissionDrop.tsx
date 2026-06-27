'use client'
import { ArrowUp } from 'lucide-react'

// Animated take-home highlight for the Creator Pro hero: your share of every collab
// rises from 90% (Free) to 92% (Pro) with a bouncing up arrow. Sits on the navy
// hero, so it uses light/green tones. Loops gently; honours prefers-reduced-motion.
const NUM = "var(--font-money, system-ui, sans-serif)"

export default function CommissionDrop() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '9px 14px', borderRadius: 12, background: 'rgba(21,122,85,.14)', border: '1px solid rgba(111,207,178,.32)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#BFEAD6' }}>And keep more of every collab</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
        <span style={{ position: 'relative', fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 17, color: '#9CA2D6' }}>
          90%
          <span aria-hidden className="cd-strike" style={{ position: 'absolute', left: -1, right: -1, top: '52%', height: 2, borderRadius: 2, background: '#9AA1B0', transformOrigin: 'left', transform: 'scaleX(1)', animation: 'comm-strike 3.8s ease-in-out infinite' }} />
        </span>
        <ArrowUp size={15} color="#6FCFB2" className="cd-arrow" style={{ animation: 'comm-bounce 1.2s ease-in-out infinite' }} />
        <span className="cd-num" style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 21, color: '#6FCFB2', animation: 'comm-pop 3.8s ease-in-out infinite' }}>92%</span>
      </span>
    </div>
  )
}
