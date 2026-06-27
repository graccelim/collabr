'use client'
import { ArrowDown } from 'lucide-react'

// Animated commission highlight for the Creator Pro hero: 10% strikes through and
// drops to 8% with a bouncing arrow. Sits on the navy hero, so it uses light/green
// tones. Loops gently; honours prefers-reduced-motion (settles on the struck 10% → 8%).
const NUM = "var(--font-money, system-ui, sans-serif)"

export default function CommissionDrop() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '9px 14px', borderRadius: 12, background: 'rgba(21,122,85,.14)', border: '1px solid rgba(111,207,178,.32)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#BFEAD6' }}>And earn higher commissions</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
        <span style={{ position: 'relative', fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 17, color: '#9CA2D6' }}>
          10%
          <span aria-hidden style={{ position: 'absolute', left: -1, right: -1, top: '52%', height: 2, borderRadius: 2, background: '#E98080', transformOrigin: 'left', transform: 'scaleX(1)', animation: 'comm-strike 3.8s ease-in-out infinite' }} />
        </span>
        <ArrowDown size={15} color="#6FCFB2" style={{ animation: 'comm-bounce 1.2s ease-in-out infinite' }} />
        <span style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 21, color: '#6FCFB2', animation: 'comm-pop 3.8s ease-in-out infinite' }}>8%</span>
      </span>
    </div>
  )
}
