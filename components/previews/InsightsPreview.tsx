'use client'
import { useEffect, useState } from 'react'
import { ArrowUpRight, Eye, BarChart3, Activity } from 'lucide-react'
import PostingBars from '@/components/studio/PostingBars'

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

// Average views by time of day (the "best time to post" chart). Best block = evening.
const TIMES = [
  { label: '12am', v: 4 }, { label: '4am', v: 3 }, { label: '8am', v: 7 },
  { label: '12pm', v: 10 }, { label: '4pm', v: 13 }, { label: '8pm', v: 18 },
]
const WORKING = [
  { t: 'Reviews are your strongest style', s: 'best style', you: 21.2, base: 17.8, conf: 'High', col: '#157A55' },
  { t: 'Carousels beat single images', s: 'best format', you: 20.1, base: 17.8, conf: 'Medium', col: '#5B53E0' },
]

const STATS: { v: string; l: string; d: number; icon: typeof Eye }[] = [
  { v: '15.5k', l: 'Median views', d: 18, icon: Eye },
  { v: '16.4k', l: 'Avg views', d: 16, icon: BarChart3 },
  { v: '17.8%', l: 'Avg engagement', d: 8, icon: Activity },
]
const LINE = TIMES.map((t) => ({ label: t.label, avgViews: t.v, posts: 1 }))

export default function InsightsPreview() {
  const [run, setRun] = useState(false)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setRun(true), 120)
    const id = setInterval(() => setActive((i) => (i + 1) % WORKING.length), 2000)
    return () => { clearTimeout(t); clearInterval(id) }
  }, [])

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
          <div style={{ fontSize: 14.5, lineHeight: 1.5, color: '#fff' }}>Short street food reviews posted in the evening are your strongest format right now.</div>
        </div>
      </div>

      {/* stats with deltas */}
      <div style={{ display: 'flex', padding: '16px 14px', gap: 10, borderBottom: '1px solid rgba(14,16,22,.06)' }}>
        {STATS.map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: '#EEF1F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><s.icon size={13} color="#2A3A8F" /></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 10.5, fontWeight: 700, color: '#0F7A4D', background: '#EAF4EE', borderRadius: 999, padding: '2px 6px' }}><ArrowUpRight size={10} />{s.d}%</span>
            </div>
            <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 21, fontWeight: 700, letterSpacing: '-.03em', color: '#0E1016' }}>{s.v}</div>
            <div style={{ fontSize: 10.5, color: '#8A909C', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* best time to post */}
      <div style={{ padding: '14px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A909C' }}>Best time to post</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#2A3A8F', background: '#EEF1F8', border: '1px solid rgba(42,58,143,.2)', borderRadius: 999, padding: '3px 9px' }}>Peak 8pm to 12am</span>
        </div>
        <PostingBars data={LINE} height={120} />
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
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: '#2A3157' }}>
          Schedule more evening posts
        </div>
      </div>
    </div>
  )
}
