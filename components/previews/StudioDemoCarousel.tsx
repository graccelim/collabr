'use client'
import { useEffect, useState } from 'react'
import InsightsPreview from '@/components/previews/InsightsPreview'
import ContentLabPreview from '@/components/previews/ContentLabPreview'
import CollabAnalysisPreview from '@/components/previews/CollabAnalysisPreview'

// Auto-advancing demo carousel for the locked Creator Studio — cycles through the
// real product surfaces (Insights → Content Lab → Collaboration analysis) with a
// slide transition. Tabs let you jump; hovering pauses. Each slide re-mounts on
// activation (key) so its own entrance/animation replays.
const SLIDES = [
  { key: 'insights', label: 'Insights', node: InsightsPreview },
  { key: 'lab', label: 'Content Lab', node: ContentLabPreview },
  { key: 'collab', label: 'Collab analysis', node: CollabAnalysisPreview },
]
const PERIOD = 6000

export default function StudioDemoCarousel() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setI((x) => (x + 1) % SLIDES.length), PERIOD)
    return () => clearInterval(id)
  }, [paused, i])
  const Active = SLIDES[i].node

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* tabs with auto-advance progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {SLIDES.map((s, idx) => {
          const on = idx === i
          return (
            <button key={s.key} type="button" onClick={() => setI(idx)}
              style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${on ? 'rgba(91,83,224,.4)' : 'rgba(20,30,80,.1)'}`, background: on ? 'rgba(91,83,224,.08)' : '#fff', color: on ? '#0E1016' : '#8A909C', fontSize: 12.5, fontWeight: 600, borderRadius: 999, padding: '8px 15px' }}>
              {s.label}
              {on && !paused && (
                <span key={i} style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: '100%', background: '#5B53E0', transformOrigin: 'left', animation: `demo-progress ${PERIOD}ms linear both` }} />
              )}
            </button>
          )
        })}
      </div>

      {/* slide */}
      <div style={{ overflow: 'hidden' }}>
        <div key={i} style={{ animation: 'demo-slide-in .5s cubic-bezier(.16,1,.3,1) both' }}>
          <Active />
        </div>
      </div>
    </div>
  )
}
