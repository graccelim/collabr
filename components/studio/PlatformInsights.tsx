'use client'
import { useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import type { Insight } from '@/lib/analytics/insights'

// One platform's analytics, rendered as the Collabr Studio design: a cohesive
// hero (analyst read + 3 stats + trend chart), "What's working" (ranked, with a
// your-value-vs-your-average bar + "+N pts" delta), and quiet Watch / Worth-trying
// cards. Everything is vs the creator's OWN history — never other creators.

const GRID = 'linear-gradient(118deg,#0A0C22 0%,#181E45 58%,#0A0C22 100%)'
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)',
  backgroundSize: '26px 26px',
  WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)',
  maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)',
}
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const MONO = "var(--font-mono, 'Geist Mono', ui-monospace, monospace)"
const NUM = "var(--font-money, 'Bricolage Grotesque', system-ui, sans-serif)"
const CONF: Record<string, [string, string]> = { high: ['#157A55', 'High confidence'], medium: ['#5B53E0', 'Medium confidence'], low: ['#8A909C', 'Early signal'] }
const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

function fmtViews(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1000) { const k = v / 1000; return `${k % 1 === 0 ? k : k.toFixed(1)}k` }
  return String(Math.round(v))
}
const fmtPct = (frac: number | null | undefined) => (frac == null ? '—' : `${(frac * 100).toFixed(1)}%`)

function Conf({ c }: { c: string }) {
  const [col, label] = CONF[c] || CONF.low
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#8A909C' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: col }} />{label}
    </span>
  )
}

function Bar({ you, base }: { you: number; base: number }) {
  const max = Math.max(you, base) * 1.18
  const yw = Math.max(3, (you / max) * 100)
  const bm = (base / max) * 100
  return (
    <span style={{ position: 'relative', display: 'block', flex: 1, maxWidth: 150, height: 6, background: '#EAEDF3', borderRadius: 999 }}>
      <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${yw}%`, background: '#157A55', borderRadius: 999 }} />
      <span style={{ position: 'absolute', left: `${bm}%`, top: -3, width: 1.5, height: 12, background: '#9AA1B0', borderRadius: 1 }} />
    </span>
  )
}

// Average-views-by-time-of-day bar chart (the "best time to post" view). The
// highest-average block is highlighted in violet.
function PostingBars({ data }: { data: { label: string; avgViews: number; posts: number }[] }) {
  const max = Math.max(1, ...data.map((b) => b.avgViews))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 92 }}>
      {data.map((b, i) => {
        const best = b.avgViews > 0 && b.avgViews === max
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }} title={`${b.posts} post${b.posts === 1 ? '' : 's'}`}>
              <div style={{ width: '100%', height: b.avgViews ? `${Math.max(6, (b.avgViews / max) * 100)}%` : 3, background: best ? '#5B53E0' : '#D7DAEC', borderRadius: '4px 4px 0 0', animation: 'ci-wipe .7s ease both' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: best ? 700 : 500, color: best ? '#5B53E0' : '#9AA0AE', fontFamily: MONO }}>{b.label}</span>
          </div>
        )
      })}
    </div>
  )
}

const Action = ({ text }: { text: string }) => (
  <div style={{ marginTop: 11, fontSize: 13, fontWeight: 600, color: '#0E1016', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    {text}<ArrowRight size={13} />
  </div>
)

function Row({ m, top }: { m: Insight; top: boolean }) {
  const hasBar = typeof m.you === 'number' && typeof m.base === 'number'
  const delta = hasBar ? (m.you! - m.base!) : null
  return (
    <div className="pi-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center', padding: top ? '2px 0 18px' : '18px 0', borderTop: top ? 'none' : '1px solid rgba(14,16,22,.07)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0E1016' }}>{m.title}</div>
        <div className="pi-why" style={{ fontSize: 12.5, color: '#8A909C', marginTop: 2, lineHeight: 1.45 }}>{m.why}</div>
        {hasBar && (
          <div className="pi-bar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 11 }}>
            <Bar you={m.you!} base={m.base!} />
            <span style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#8A909C' }}>{m.you}% <span style={{ color: '#B4B9C4' }}>vs {m.base}% avg</span></span>
          </div>
        )}
        <Action text={m.recommendation} />
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        {delta != null && (
          <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: delta >= 0 ? '#157A55' : '#B26B00' }}>
            {delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)}<span style={{ fontSize: 12, fontWeight: 600, color: '#8A909C', marginLeft: 2 }}>pts</span>
          </div>
        )}
        <div style={{ marginTop: delta != null ? 7 : 0 }}><Conf c={m.confidence} /></div>
      </div>
    </div>
  )
}

type Data = {
  postCount?: number
  overview?: { medianViews: number | null; avgViews: number | null; avgEngagementRate: number | null }
  postingTimes?: { label: string; name: string; avgViews: number; posts: number }[]
  bestTime?: string | null
  insights?: Insight[]
  strongest?: string | null
}

// "What's working" focuses on CONTENT levers only (topic, format, length, style).
// Posting time has its own chart; cadence/views-trend/outperformers are excluded.
const CONTENT_KEYS = ['best_category', 'best_subcategory', 'best_format', 'best_length', 'best_style', 'emerging_category']

export default function PlatformInsights({ row }: { row: { platform: string; data: Data; ai_narrative: string | null } }) {
  const [open, setOpen] = useState(false)
  const d = row.data || {}
  const insights = Array.isArray(d.insights) ? d.insights : []
  const postCount = d.postCount ?? 0

  // Learning state — connected but not enough analysed yet.
  if (!insights.length) {
    return (
      <div style={{ ...CARD, padding: '22px 24px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8A909C', marginBottom: 8 }}>Still learning</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0E1016' }}>We're still learning your patterns here.</div>
        <p style={{ fontSize: 13, color: '#545A66', lineHeight: 1.5, margin: '6px 0 0', maxWidth: 460 }}>
          Richer insights appear as more of your posts sync. Your history is kept forever, even after the native app deletes it.
        </p>
      </div>
    )
  }

  const experiment = insights.find((i) => i.key === 'experiment')
  const watch = insights.find((i) => i.key === 'declining_category')
  const working = insights.filter((i) => CONTENT_KEYS.includes(i.key) && i !== watch)
    .sort((a, b) => (RANK[b.confidence] - RANK[a.confidence]) || (((b.you ?? 0) - (b.base ?? 0)) - ((a.you ?? 0) - (a.base ?? 0))))
  const vis = working.slice(0, 3), hid = working.slice(3)

  const read = row.ai_narrative || (working[0] ? `${working[0].title}.` : 'Your strongest patterns are still taking shape as more posts sync.')
  const stats = [
    { v: fmtViews(d.overview?.medianViews), label: 'Median views' },
    { v: fmtViews(d.overview?.avgViews), label: 'Avg views' },
    { v: fmtPct(d.overview?.avgEngagementRate), label: 'Avg engagement' },
  ]
  const postingTimes = d.postingTimes || []

  return (
    <div>
      {/* hero: analyst read + metrics + trend */}
      <div style={{ ...CARD, borderRadius: 18, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 22px 48px -30px rgba(20,30,80,.32)' }}>
        <div style={{ position: 'relative', padding: '20px 24px', background: GRID, overflow: 'hidden' }}>
          <div style={TEXTURE} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: '#7B73F0', boxShadow: '0 0 0 3px rgba(123,115,240,.22)' }} />
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9AA0D6' }}>Analyst read</span>
            </div>
            <div style={{ fontSize: 15.5, lineHeight: 1.5, color: '#fff', maxWidth: 660 }}>{read}</div>
          </div>
        </div>
        <div className="pi-stats" style={{ display: 'flex', padding: '20px 0', borderBottom: '1px solid rgba(14,16,22,.06)' }}>
          {stats.map((s, i) => (
            <div key={i} className="pi-stat" style={{ flex: 1, padding: '2px 22px' }}>
              <div className="pi-statv" style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: '#0E1016' }}>{s.v}</div>
              <div style={{ fontSize: 12, color: '#8A909C', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {postingTimes.some((b) => b.posts > 0) && (
          <div style={{ padding: '16px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A909C' }}>Best time to post</span>
              {d.bestTime && <span style={{ fontSize: 12, fontWeight: 600, color: '#5B53E0' }}>{d.bestTime}</span>}
            </div>
            <PostingBars data={postingTimes} />
            <div style={{ fontSize: 11.5, color: '#B4B9C4', marginTop: 8 }}>Average views by time of day, from {postCount} of your posts.</div>
          </div>
        )}
      </div>

      {/* what's working */}
      <div style={{ ...CARD, padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: '#0E1016' }}>What's working</span>
          <span style={{ fontSize: 12, color: '#8A909C' }}>vs your own average</span>
        </div>
        {vis.map((m, i) => <Row key={i} m={m} top={i === 0} />)}
        {hid.length > 0 && open && hid.map((m, i) => <Row key={`h${i}`} m={m} top={false} />)}
        {hid.length > 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: '100%', cursor: 'pointer', marginTop: 4, padding: '13px 0 2px', border: 'none', borderTop: '1px solid rgba(14,16,22,.07)', background: 'transparent', color: '#545A66', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            {open ? 'Show less' : `Show ${hid.length} more`}
            <ChevronDown size={14} style={{ transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
          </button>
        )}
      </div>

      {/* watch + experiment */}
      {(watch || experiment) && (
        <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: watch && experiment ? '1fr 1fr' : '1fr', gap: 14 }}>
          {watch && (
            <div style={{ ...CARD, borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: '#B26B00' }} />
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#B26B00' }}>Keep an eye on</span>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0E1016' }}>{watch.title}</div>
              <div style={{ fontSize: 13, color: '#545A66', lineHeight: 1.5, marginTop: 5 }}>{watch.evidence}</div>
              <Action text={watch.recommendation} />
            </div>
          )}
          {experiment && (
            <div style={{ ...CARD, borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: '#5B53E0' }} />
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#5B53E0' }}>Worth trying</span>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0E1016' }}>{experiment.title}</div>
              <div style={{ fontSize: 13, color: '#545A66', lineHeight: 1.5, marginTop: 5 }}>{experiment.why}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: '#B4B9C4', marginTop: 18, textAlign: 'center' }}>
        Based on {postCount} of your own posts. We never compare you to other creators, only to your own history.
      </div>
    </div>
  )
}
