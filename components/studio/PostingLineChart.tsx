'use client'
import { useEffect, useRef, useState } from 'react'

// Smooth area + line "best time to post" chart with a peak marker + tooltip.
// The line draws in (and the area/peak fade in) every time the chart becomes
// visible — so it animates on mount, platform switch, tab switch and in the demo.
// Respects prefers-reduced-motion.
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x},${pts[0].y}` : ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

export default function PostingLineChart({ data, peakLabel, caption, height = 160 }: {
  data: { label: string; avgViews: number; posts: number }[]
  peakLabel?: string
  caption?: string
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [run, setRun] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setRun(true); return }
    const io = new IntersectionObserver(([e]) => setRun(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const W = 600, H = 160, padX = 10, padTop = 34, padBot = 6
  const n = data.length
  const max = Math.max(1, ...data.map((d) => d.avgViews))
  const pts = data.map((d, i) => ({ x: padX + (n > 1 ? (i / (n - 1)) * (W - 2 * padX) : 0), y: H - padBot - (d.avgViews / max) * (H - padTop - padBot) }))
  const line = smoothPath(pts)
  const area = `${line} L ${pts[n - 1].x},${H} L ${pts[0].x},${H} Z`
  const peakIdx = data.reduce((bi, d, i) => (d.avgViews > data[bi].avgViews ? i : bi), 0)
  const peak = pts[peakIdx]
  const pX = (peak.x / W) * 100, pY = (peak.y / H) * 100

  return (
    <div ref={ref}>
      <div className="plc-area" style={{ position: 'relative', height }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block', position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id="plc-area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5B53E0" stopOpacity="0.2" /><stop offset="1" stopColor="#5B53E0" stopOpacity="0" /></linearGradient>
            <linearGradient id="plc-line-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6B62EC" /><stop offset="1" stopColor="#4B43C8" /></linearGradient>
          </defs>
          {[0, 0.33, 0.66, 1].map((f) => { const y = padTop + (H - padTop - padBot) * f; return <line key={f} x1="0" x2={W} y1={y} y2={y} stroke={f === 1 ? 'rgba(20,30,80,.1)' : 'rgba(20,30,80,.06)'} strokeWidth={1} vectorEffect="non-scaling-stroke" /> })}
          <path d={area} fill="url(#plc-area-fill)" style={{ opacity: run ? 1 : 0, transition: 'opacity .8s ease .25s' }} />
          <line x1={peak.x} x2={peak.x} y1={peak.y} y2={H - padBot} stroke="rgba(91,83,224,.32)" strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ opacity: run ? 1 : 0, transition: 'opacity .4s ease .9s' }} />
          <path d={line} fill="none" stroke="url(#plc-line-grad)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: run ? 0 : 1, transition: 'stroke-dashoffset 1.1s cubic-bezier(.6,.05,.2,1)' }} />
        </svg>
        {/* peak dot (HTML overlay — avoids preserveAspectRatio distortion) */}
        <span style={{ position: 'absolute', left: `${pX}%`, top: `${pY}%`, width: 9, height: 9, borderRadius: 999, background: '#fff', border: '2.5px solid #5B53E0', transform: 'translate(-50%,-50%)', boxShadow: '0 2px 8px -2px rgba(91,83,224,.7)', opacity: run ? 1 : 0, transition: 'opacity .3s ease 1s' }} />
        {/* peak tooltip */}
        {peakLabel && (
          <div style={{ position: 'absolute', left: `${pX}%`, top: `${pY}%`, transform: 'translate(-50%,-145%)', opacity: run ? 1 : 0, transition: 'opacity .35s ease 1.05s', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            <div style={{ background: '#0E1016', color: '#fff', borderRadius: 9, padding: '6px 11px', textAlign: 'center', boxShadow: '0 10px 24px -10px rgba(14,16,22,.6)' }}>
              <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>{peakLabel}</div>
              <div style={{ fontSize: 9.5, color: '#AEB3DC', marginTop: 1 }}>Avg views</div>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', marginTop: 9 }}>
        {data.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 11, fontWeight: i === peakIdx ? 600 : 500, color: i === peakIdx ? '#5B53E0' : '#A2A8B6' }}>{d.label}</span>)}
      </div>
      {caption && <div style={{ fontSize: 11.5, color: '#B4B9C4', marginTop: 11, textAlign: 'center' }}>{caption}</div>}
    </div>
  )
}
