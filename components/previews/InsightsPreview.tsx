'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'

// A LIVE-feeling preview of Creator Studio Insights with clearly-labelled SAMPLE
// data (never the user's real numbers). Animated: trend wipes in, stat + delta
// count up, bars grow, the strongest insight pulses. Purely a product teaser.
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"
const GRID = 'linear-gradient(118deg,#0A0C22 0%,#181E45 58%,#0A0C22 100%)'
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)',
  backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)', maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)',
}

const TREND = [10, 7, 12, 16, 9, 11, 7, 8, 12, 14, 15, 13, 12, 16, 14, 18]
const WORKING = [
  { t: 'Post in the evening', s: '6pm–12am', you: 18.9, base: 17.8, conf: 'High', col: '#157A55' },
  { t: 'Keep videos under 15s', s: 'short formats', you: 20.1, base: 17.8, conf: 'Medium', col: '#5B53E0' },
]

function useCountUp(target: number, run: boolean, ms = 900, dp = 0): string {
  const [v, setV] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!run) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / ms, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setV(target * e)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, run, ms])
  return v.toFixed(dp)
}

function Sparkline({ run }: { run: boolean }) {
  const W = 560, H = 60, n = TREND.length, max = Math.max(...TREND), min = Math.min(...TREND)
  const x = (i: number) => (i / (n - 1)) * W
  const y = (val: number) => H - 5 - ((val - min) / Math.max(1, max - min)) * (H - 14)
  let line = `M ${x(0).toFixed(1)} ${y(TREND[0]).toFixed(1)}`
  for (let i = 1; i < n; i++) line += ` L ${x(i).toFixed(1)} ${y(TREND[i]).toFixed(1)}`
  const area = `${line} L ${W} ${H} L 0 ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={60} style={{ display: 'block', animation: run ? 'ci-wipe 1s ease both' : 'none' }}>
      <defs>
        <linearGradient id="ipg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5B53E0" stopOpacity="0.16" /><stop offset="1" stopColor="#5B53E0" stopOpacity="0" /></linearGradient>
        <linearGradient id="ipl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3B4470" /><stop offset="1" stopColor="#5B53E0" /></linearGradient>
      </defs>
      {[0.33, 0.66].map((f) => <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="rgba(20,30,80,.07)" strokeWidth={1} />)}
      <path d={area} fill="url(#ipg)" />
      <path d={line} fill="none" stroke="url(#ipl)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(n - 1)} cy={y(TREND[n - 1])} r={3.5} fill="#5B53E0" />
    </svg>
  )
}

export default function InsightsPreview() {
  const [run, setRun] = useState(false)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setRun(true), 120)
    const id = setInterval(() => setActive((i) => (i + 1) % WORKING.length), 2000)
    return () => { clearTimeout(t); clearInterval(id) }
  }, [])
  const eng = useCountUp(17.8, run, 1000, 1)

  return (
    <div style={{ position: 'relative', background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(14,16,22,.04),0 30px 60px -34px rgba(20,30,80,.4)', animation: 'clp-rise-safe .6s cubic-bezier(.16,1,.3,1) both' }}>
      {/* analyst read */}
      <div style={{ position: 'relative', padding: '18px 22px', background: GRID, overflow: 'hidden' }}>
        <div style={TEXTURE} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: '#7B73F0', boxShadow: '0 0 0 3px rgba(123,115,240,.22)' }} />
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9AA0D6' }}>Analyst read</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6B70A6', border: '1px solid rgba(255,255,255,.16)', padding: '3px 8px', borderRadius: 999 }}>Sample</span>
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.5, color: '#fff' }}>Short street-food reviews, posted in the evening, are your strongest formula right now.</div>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: 'flex', padding: '16px 0', borderBottom: '1px solid rgba(14,16,22,.06)' }}>
        {[['15.5k', 'Median views'], ['16.4k', 'Avg views'], [`${eng}%`, 'Avg engagement']].map(([v, l], i) => (
          <div key={i} style={{ flex: 1, padding: '0 20px' }}>
            <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', color: '#0E1016' }}>{v}</div>
            <div style={{ fontSize: 11.5, color: '#8A909C', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* trend */}
      <div style={{ padding: '14px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A909C' }}>Views over time</span>
          <span style={{ fontSize: 11, color: '#B4B9C4' }}>your full history</span>
        </div>
        <Sparkline run={run} />
      </div>

      {/* what's working */}
      <div style={{ padding: '4px 22px 20px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1016', marginBottom: 12 }}>What&apos;s working</div>
        {WORKING.map((m, i) => {
          const on = i === active
          const max = Math.max(m.you, m.base) * 1.18
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center', padding: i ? '14px 0 0' : '0', borderTop: i ? '1px solid rgba(14,16,22,.07)' : 'none', marginTop: i ? 14 : 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0E1016' }}>{m.t}</span>
                  <span style={{ fontSize: 12, color: '#8A909C' }}>{m.s}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9 }}>
                  <span style={{ position: 'relative', display: 'block', flex: 1, maxWidth: 150, height: 6, background: '#EAEDF3', borderRadius: 999 }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 999, background: m.col, width: run ? `${Math.max(3, (m.you / max) * 100)}%` : '0%', transition: `width .9s cubic-bezier(.16,1,.3,1) ${0.2 + i * 0.15}s` }} />
                    <span style={{ position: 'absolute', left: `${(m.base / max) * 100}%`, top: -3, width: 1.5, height: 12, background: '#9AA1B0', borderRadius: 1 }} />
                  </span>
                  <span style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: '#8A909C' }}>{m.you}% <span style={{ color: '#B4B9C4' }}>vs {m.base}%</span></span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none', transition: 'transform .3s ease', transform: on ? 'scale(1.04)' : 'none' }}>
                <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 21, fontWeight: 700, letterSpacing: '-.02em', color: '#157A55' }}>+{(m.you - m.base).toFixed(1)}<span style={{ fontSize: 11, fontWeight: 600, color: '#8A909C', marginLeft: 2 }}>pts</span></div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 11, color: '#8A909C' }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: m.col }} />{m.conf}
                </div>
              </div>
            </div>
          )
        })}
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: '#0E1016', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Schedule more evening posts <ArrowRight size={13} />
        </div>
      </div>
    </div>
  )
}
