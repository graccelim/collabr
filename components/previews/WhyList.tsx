'use client'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

// Animated reason list: ticks fill in one by one to say why this is worth it.
// Used above the roster preview on the Discover / Invites gate.
export default function WhyList({ reasons }: { reasons: string[] }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= reasons.length) return
    const t = setTimeout(() => setShown((n) => n + 1), 320 + shown * 60)
    return () => clearTimeout(t)
  }, [shown, reasons.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {reasons.map((r, i) => {
        const on = i < shown
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: on ? 1 : 0.32, transition: 'opacity .35s ease' }}>
            <span style={{
              width: 24, height: 24, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: on ? '#157A55' : '#E7EAF1', transition: 'background .35s ease',
              animation: on ? 'demo-tick .4s cubic-bezier(.16,1,.3,1) both' : 'none',
            }}>
              <Check size={14} color={on ? '#fff' : '#B4B9C4'} strokeWidth={2.6} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#26303F' }}>{r}</span>
          </div>
        )
      })}
    </div>
  )
}
