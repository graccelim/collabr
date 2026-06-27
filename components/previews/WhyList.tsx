'use client'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

// Animated reason list shaped like a timeline: ticks fill in one by one and a
// connector line between them fills green as each tick lands. Smaller on mobile
// (via .why-list overrides); desktop sizing is unchanged.
export default function WhyList({ reasons }: { reasons: string[] }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= reasons.length) return
    const t = setTimeout(() => setShown((n) => n + 1), 300 + shown * 110)
    return () => clearTimeout(t)
  }, [shown, reasons.length])

  return (
    <div className="why-list" style={{ display: 'flex', flexDirection: 'column' }}>
      {reasons.map((r, i) => {
        const on = i < shown
        const last = i === reasons.length - 1
        return (
          <div key={i} className="why-row" style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            {/* rail: tick + connector line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
              <span className="why-tick" style={{
                width: 24, height: 24, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? '#157A55' : '#E7EAF1', transition: 'background .35s ease',
                animation: on ? 'demo-tick .4s cubic-bezier(.16,1,.3,1) both' : 'none',
              }}>
                <Check size={14} color={on ? '#fff' : '#B4B9C4'} strokeWidth={2.6} />
              </span>
              {!last && (
                <span className="why-line" style={{ width: 2, flex: 1, margin: '3px 0', background: '#E7EAF1', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', inset: 0, background: '#157A55', transformOrigin: 'top', transform: on ? 'scaleY(1)' : 'scaleY(0)', transition: 'transform .45s ease' }} />
                </span>
              )}
            </div>
            <span className="why-text" style={{ fontSize: 14, fontWeight: 500, color: '#26303F', paddingBottom: last ? 0 : 16, opacity: on ? 1 : 0.4, transition: 'opacity .35s ease', alignSelf: 'flex-start' }}>{r}</span>
          </div>
        )
      })}
    </div>
  )
}
