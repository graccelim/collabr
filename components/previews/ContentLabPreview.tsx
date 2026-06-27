'use client'
import { useEffect, useRef, useState } from 'react'
import { Zap, Copy } from 'lucide-react'

// Sample Content Lab demo: the topic types itself in, the Generate button presses,
// then hooks "generate" and appear one by one. Replays each time the slide opens.
const MONO = "var(--font-mono, ui-monospace, monospace)"
const TOPIC = 'Street food crawl'
const HOOKS = [
  '$5 street food challenge: what can it actually buy?',
  'I ranked every satay stall on this street',
  'The short edit that doubled my saves',
  '3 stalls only locals know about',
]
const dark: React.CSSProperties = { fontSize: 13, color: '#fff', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 9, padding: '9px 12px', minHeight: 36, display: 'flex', alignItems: 'center' }

export default function ContentLabPreview() {
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState<'typing' | 'gen' | 'list'>('typing')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    let i = 0
    const step = () => {
      if (i < TOPIC.length) { i++; setTyped(TOPIC.slice(0, i)); timer.current = setTimeout(step, 55) }
      else { timer.current = setTimeout(() => { setPhase('gen'); timer.current = setTimeout(() => setPhase('list'), 950) }, 480) }
    }
    timer.current = setTimeout(step, 350)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(14,16,22,.04),0 30px 60px -34px rgba(20,30,80,.4)' }}>
      {/* dark form bar */}
      <div style={{ position: 'relative', padding: '16px 20px', background: 'linear-gradient(118deg,#0A0C22,#181E45 58%,#0A0C22)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)', backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)', maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9AA0D6', marginBottom: 10 }}>Content Lab</div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...dark, flex: 1, minWidth: 120 }}>
              {typed ? <span style={{ color: '#fff' }}>{typed}</span> : <span style={{ color: 'rgba(255,255,255,.4)' }}>Topic…</span>}
              {phase === 'typing' && <span style={{ display: 'inline-block', width: 1.5, height: 15, background: '#fff', marginLeft: 2, animation: 'demo-blink 1s step-end infinite' }} />}
            </span>
            <span style={{ ...dark, width: 84 }}>TikTok</span>
            <span style={{ background: '#fff', color: '#0A0C22', fontSize: 13, fontWeight: 600, borderRadius: 9, padding: '9px 16px', display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'transform .15s ease', transform: phase === 'gen' ? 'scale(.96)' : 'none', opacity: phase === 'typing' ? 0.75 : 1 }}>
              {phase === 'gen' && <span style={{ width: 13, height: 13, borderRadius: 999, border: '2px solid rgba(10,12,34,.25)', borderTopColor: '#0A0C22', display: 'inline-block', animation: 'cp-spin .7s linear infinite' }} />}
              {phase === 'gen' ? 'Generating' : 'Generate'}
            </span>
          </div>
        </div>
      </div>

      {/* output */}
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 13, borderBottom: '1px solid rgba(14,16,22,.07)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(91,83,224,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={15} color="#5B53E0" /></span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>Hooks</span>
            {phase === 'list' && <span style={{ fontSize: 12, color: '#B4B9C4' }}>{HOOKS.length}</span>}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#B4B9C4', border: '1px solid rgba(20,30,80,.12)', padding: '3px 8px', borderRadius: 999 }}>Sample</span>
        </div>

        {phase !== 'list' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 2px', color: '#8A909C', fontSize: 13 }}>
            {phase === 'gen' && <span style={{ width: 16, height: 16, borderRadius: 999, border: '2px solid rgba(91,83,224,.3)', borderTopColor: '#5B53E0', display: 'inline-block', animation: 'cp-spin .7s linear infinite' }} />}
            {phase === 'gen' ? 'Generating ideas from your strongest content.' : 'Enter a topic to generate hooks from your own content.'}
          </div>
        ) : (
          HOOKS.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: '13px 0', borderTop: i ? '1px solid rgba(14,16,22,.06)' : 'none', animation: `clp-rise-safe .5s cubic-bezier(.16,1,.3,1) ${(i * 0.1).toFixed(2)}s both` }}>
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
