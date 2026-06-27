'use client'
import { useEffect, useRef, useState } from 'react'
import { TrendingUp, Repeat, FlaskConical } from 'lucide-react'

// Sample Collaboration Analysis demo — a finished collab explained from the
// creator's own data: stat tiles (count up), an analyst read, and clear moves.
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"

function useCountUp(target: number, run: boolean, ms = 1100): number {
  const [v, setV] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!run) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / ms, 1)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, run, ms])
  return v
}

const MOVES = [
  { icon: Repeat, col: '#157A55', t: 'Keep posting in the evening', s: 'Your evening posts (6pm to 12am) consistently outperform your average.' },
  { icon: FlaskConical, col: '#5B53E0', t: 'Make more short tutorial Reels', s: 'They beat your baseline on this collaboration. Lean in.' },
]

export default function CollabAnalysisPreview() {
  const [run, setRun] = useState(false)
  useEffect(() => { const t = setTimeout(() => setRun(true), 140); return () => clearTimeout(t) }, [])
  const pts = useCountUp(2.3, run)
  const views = useCountUp(24.1, run)

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(14,16,22,.04),0 30px 60px -34px rgba(20,30,80,.4)' }}>
      {/* dark band */}
      <div style={{ position: 'relative', padding: '18px 22px', background: 'linear-gradient(118deg,#0A0C22,#181E45 58%,#0A0C22)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)', backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)', maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9AA0D6', marginBottom: 6 }}>Collaboration analysis</div>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: '#fff' }}>Glow Beauty × you</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 17, fontWeight: 700, color: '#6FCFB2' }}>
            <TrendingUp size={16} color="#6FCFB2" /> +{pts.toFixed(1)} pts
          </span>
        </div>
      </div>

      {/* stat tiles */}
      <div style={{ display: 'flex', gap: 10, padding: '16px 18px 4px' }}>
        {[
          { v: `+${pts.toFixed(1)} pts`, l: 'vs your baseline', c: '#157A55' },
          { v: `${views.toFixed(1)}k`, l: 'top post views', c: '#1E2A4A' },
          { v: 'Reels', l: 'best format', c: '#1E2A4A' },
        ].map((t, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, padding: '13px 14px', background: '#F7F8FC', border: '1px solid rgba(20,30,80,.07)', borderRadius: 12 }}>
            <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color: t.c }}>{t.v}</div>
            <div style={{ fontSize: 11, color: '#A2A8B6', marginTop: 3 }}>{t.l}</div>
          </div>
        ))}
      </div>

      {/* analyst read + moves */}
      <div style={{ padding: '14px 22px 20px' }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#3A3F4B', margin: '0 0 16px' }}>
          This collaboration beat your baseline, led by short tutorial Reels posted in the evening. Your hook style held attention longer than usual, so it is worth repeating in the next brief.
        </p>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8A909C', marginBottom: 10 }}>Your next moves</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MOVES.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(20,30,80,.08)', background: '#fff', animation: `clp-rise-safe .5s cubic-bezier(.16,1,.3,1) ${(0.1 + i * 0.1).toFixed(2)}s both` }}>
              <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: `${r.col}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><r.icon size={15} color={r.col} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0E1016' }}>{r.t}</div>
                <div style={{ fontSize: 12, color: '#8A909C', marginTop: 1 }}>{r.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
