'use client'
import { useEffect, useState } from 'react'
import { Zap, Copy } from 'lucide-react'

// Sample Content Lab demo: a topic "generates" hooks that appear one by one.
const MONO = "var(--font-mono, ui-monospace, monospace)"
const HOOKS = [
  '$5 street-food challenge — what can it buy?',
  'I ranked every satay stall on this street',
  'The under-15s edit that doubled my saves',
  '3 stalls only locals know',
]
const dark: React.CSSProperties = { fontSize: 13, color: '#fff', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 9, padding: '9px 12px' }

export default function ContentLabPreview() {
  const [phase, setPhase] = useState<'gen' | 'list'>('gen')
  useEffect(() => { const t = setTimeout(() => setPhase('list'), 950); return () => clearTimeout(t) }, [])
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(14,16,22,.04),0 30px 60px -34px rgba(20,30,80,.4)' }}>
      {/* dark form bar */}
      <div style={{ position: 'relative', padding: '16px 20px', background: 'linear-gradient(118deg,#0A0C22,#181E45 58%,#0A0C22)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)', backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)', maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9AA0D6', marginBottom: 10 }}>Content Lab</div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...dark, flex: 1, minWidth: 120 }}>Street food crawl</span>
            <span style={{ ...dark, width: 84 }}>TikTok</span>
            <span style={{ background: '#fff', color: '#0A0C22', fontSize: 13, fontWeight: 600, borderRadius: 9, padding: '9px 16px' }}>{phase === 'gen' ? 'Generating…' : 'Generate'}</span>
          </div>
        </div>
      </div>

      {/* output */}
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 13, borderBottom: '1px solid rgba(14,16,22,.07)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(91,83,224,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={15} color="#5B53E0" /></span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>Hooks</span>
            <span style={{ fontSize: 12, color: '#B4B9C4' }}>{HOOKS.length}</span>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#B4B9C4', border: '1px solid rgba(20,30,80,.12)', padding: '3px 8px', borderRadius: 999 }}>Sample</span>
        </div>

        {phase === 'gen' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 2px', color: '#8A909C', fontSize: 13 }}>
            <span style={{ width: 16, height: 16, borderRadius: 999, border: '2px solid rgba(91,83,224,.3)', borderTopColor: '#5B53E0', display: 'inline-block', animation: 'cp-spin .7s linear infinite' }} />
            Generating ideas tuned to your best-performing content…
          </div>
        ) : (
          HOOKS.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: i ? '13px 0' : '13px 0', borderTop: i ? '1px solid rgba(14,16,22,.06)' : 'none', animation: `clp-rise-safe .5s cubic-bezier(.16,1,.3,1) ${(i * 0.1).toFixed(2)}s both` }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: '#C4CAD6', marginTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: '#0E1016' }}>{h}</span>
              </div>
              <Copy size={15} color="#B4B9C4" style={{ flex: 'none', marginTop: 2 }} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
