'use client'
import { useEffect, useRef, useState } from 'react'

// "Best time to post" — navy, sharp bars (no peak value label). Grows in when it
// scrolls into view, so it animates on mount, platform switch, tab switch and demo.
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NAVY = '#2A3157'
const IDLE = '#E4E7F0'

export default function PostingBars({ data, caption, height = 150 }: {
  data: { label: string; avgViews: number; posts: number }[]
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

  const max = Math.max(1, ...data.map((d) => d.avgViews))
  const peakIdx = data.reduce((bi, d, i) => (d.avgViews > data[bi].avgViews ? i : bi), 0)

  return (
    <div ref={ref}>
      <div className="plc-area" style={{ position: 'relative', height }}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <div key={f} style={{ position: 'absolute', left: 0, right: 0, top: `${f * 100}%`, height: 1, background: f === 1 ? 'rgba(20,30,80,.12)' : 'rgba(20,30,80,.055)' }} />
        ))}
        {/* bars */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          {data.map((b, i) => {
            const h = b.avgViews ? Math.max(4, (b.avgViews / max) * 100) : 1.5
            const peak = i === peakIdx && b.avgViews > 0
            return (
              <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{
                  width: '64%', maxWidth: 44, borderRadius: 2,
                  height: run ? `${h}%` : '0%',
                  transition: `height .6s cubic-bezier(.5,0,.2,1) ${(i * 0.05).toFixed(2)}s`,
                  background: peak ? NAVY : IDLE,
                }} />
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 9 }}>
        {data.map((b, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 11, fontWeight: i === peakIdx ? 700 : 500, color: i === peakIdx ? NAVY : '#A2A8B6' }}>{b.label}</span>
        ))}
      </div>
      {caption && <div style={{ fontSize: 11.5, color: '#B4B9C4', marginTop: 11, textAlign: 'center' }}>{caption}</div>}
    </div>
  )
}
