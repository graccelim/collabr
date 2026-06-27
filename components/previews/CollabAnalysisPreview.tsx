'use client'
import { TrendingUp, Trophy, Clock } from 'lucide-react'

// Sample Collaboration Analysis demo: a finished collab explained from the
// creator's own data (clearly labelled Sample).
const MONO = "var(--font-mono, ui-monospace, monospace)"
const ROWS = [
  { icon: TrendingUp, col: '#157A55', t: 'Reels carried this collab', s: '+2.3 pts above your average engagement' },
  { icon: Trophy, col: '#5B53E0', t: 'Your tutorial post was the top performer', s: '24.1k views · 21% engagement' },
  { icon: Clock, col: '#5B53E0', t: 'Repeat the evening posting window', s: 'Your 6pm–12am posts consistently over-index' },
]

export default function CollabAnalysisPreview() {
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
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6B70A6', border: '1px solid rgba(255,255,255,.16)', padding: '3px 8px', borderRadius: 999 }}>Sample</span>
        </div>
      </div>

      {/* analyst read + outcomes */}
      <div style={{ padding: '16px 22px 20px' }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#3A3F4B', margin: '0 0 16px', animation: 'clp-rise-safe .5s cubic-bezier(.16,1,.3,1) both' }}>
          This collab beat your baseline, led by short tutorial Reels posted in the evening. Your hook style held attention longer than usual — worth repeating in the next brief.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROWS.map((r, i) => (
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
