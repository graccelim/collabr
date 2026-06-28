'use client'
import { useState } from 'react'
import { ArrowUpRight, ArrowDownRight, ChevronDown, Clock, Eye, BarChart3, Activity } from 'lucide-react'
import PostingLineChart from '@/components/studio/PostingLineChart'
import type { Insight } from '@/lib/analytics/insights'

// One platform's Insights, per the Creator Studio handoff: analyst-read hero +
// 3 stats + a premium "best time to post" bar chart, then a ranked "What's
// working" list (index tile · navy metric bar · small green delta pill ·
// confidence), then watch/experiment cards. Green is used ONLY for positive
// deltas and "High confidence"; metric bars are ink-navy.

const GRID = 'linear-gradient(118deg,#0A0C22 0%,#181E45 58%,#0A0C22 100%)'
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)',
  backgroundSize: '26px 26px',
  WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)', maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)',
}
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"
const CONF: Record<string, [string, string]> = { high: ['#157A55', 'High confidence'], medium: ['#5B53E0', 'Medium confidence'], low: ['#8A909C', 'Early signal'] }
const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }
const CONTENT_KEYS = ['best_category', 'best_subcategory', 'best_format', 'best_length', 'best_style', 'emerging_category']

function fmtViews(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1000) { const k = v / 1000; return `${k % 1 === 0 ? k : k.toFixed(1)}k` }
  return String(Math.round(v))
}
const fmtPct = (f: number | null | undefined) => (f == null ? '—' : `${(f * 100).toFixed(1)}%`)

function ConfChip({ c }: { c: string }) {
  const [col, label] = CONF[c] || CONF.low
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#8A909C' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: col }} />{label}
    </span>
  )
}

function DeltaPill({ delta }: { delta: number }) {
  const up = delta >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flex: 'none', fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, color: up ? '#0F7A4D' : '#B4332B', background: up ? '#EAF4EE' : '#FBEDEC' }}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{up ? '+' : '−'}{Math.abs(delta).toFixed(1)} pts
    </span>
  )
}

function MetricBar({ you, base }: { you: number; base: number }) {
  const max = Math.max(you, base) * 1.18
  const yw = Math.max(4, (you / max) * 100)
  const bm = (base / max) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 10 }}>
      <span style={{ position: 'relative', display: 'block', flex: 1, maxWidth: 150, height: 6, background: '#EDEFF4', borderRadius: 999 }}>
        <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${yw}%`, background: '#2A3157', borderRadius: 999 }} />
        <span style={{ position: 'absolute', left: `${bm}%`, top: -3, width: 1.5, height: 12, background: '#AEB4C2', borderRadius: 1 }} />
      </span>
      <span style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{you}% <span style={{ color: '#B4B9C4' }}>· avg {base}%</span></span>
    </div>
  )
}

function Row({ m, idx }: { m: Insight; idx: number }) {
  const hasBar = typeof m.you === 'number' && typeof m.base === 'number'
  const delta = hasBar ? (m.you! - m.base!) : null
  return (
    <div style={{ display: 'flex', gap: 12, padding: idx === 1 ? '2px 0 16px' : '16px 0', borderTop: idx === 1 ? 'none' : '1px solid rgba(14,16,22,.06)' }}>
      <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, background: '#F3F5FB', border: '1px solid rgba(20,30,80,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11.5, color: '#5C6191' }}>{String(idx).padStart(2, '0')}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: '#0E1016' }}>{m.title}</span>
          {delta != null && <DeltaPill delta={delta} />}
        </div>
        <div style={{ fontSize: 12.5, color: '#9096A4', marginTop: 2, lineHeight: 1.45 }}>{m.why}</div>
        {hasBar && <MetricBar you={m.you!} base={m.base!} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#5B53E0' }}>{m.recommendation}</span>
          <ConfChip c={m.confidence} />
        </div>
      </div>
    </div>
  )
}

type Data = {
  postCount?: number
  overview?: { medianViews: number | null; avgViews: number | null; avgEngagementRate: number | null; medianViewsDelta?: number | null; avgViewsDelta?: number | null; engDelta?: number | null }
  postingTimes?: { label: string; name: string; avgViews: number; posts: number }[]
  bestTime?: string | null
  insights?: Insight[]
  strongest?: string | null
}

function StatDelta({ d }: { d: number | null | undefined }) {
  if (d == null) return null
  const up = d >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700, color: up ? '#0F7A4D' : '#B4332B', background: up ? '#EAF4EE' : '#FBEDEC', borderRadius: 999, padding: '3px 8px' }}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(d * 100).toFixed(0)}%
    </span>
  )
}

export default function PlatformInsights({ row }: { row: { platform: string; data: Data; ai_narrative: string | null } }) {
  const [open, setOpen] = useState(false)
  const d = row.data || {}
  const insights = Array.isArray(d.insights) ? d.insights : []
  const postCount = d.postCount ?? 0

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
  const ov = d.overview
  const stats = [
    { icon: Eye, v: fmtViews(ov?.medianViews), label: 'Median views', delta: ov?.medianViewsDelta },
    { icon: BarChart3, v: fmtViews(ov?.avgViews), label: 'Avg views', delta: ov?.avgViewsDelta },
    { icon: Activity, v: fmtPct(ov?.avgEngagementRate), label: 'Avg engagement', delta: ov?.engDelta },
  ]
  const postingTimes = d.postingTimes || []
  const peakLabel = postingTimes.length ? fmtViews(Math.max(...postingTimes.map((b) => b.avgViews))) : undefined

  return (
    <div>
      {/* hero — analyst read · stats · best-time chart, all one connected card */}
      <div style={{ ...CARD, borderRadius: 18, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 22px 48px -30px rgba(20,30,80,.32)' }}>
        {/* analyst read */}
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

        {/* stats */}
        <div className="pi-stats" style={{ display: 'flex', borderBottom: '1px solid rgba(14,16,22,.06)' }}>
          {stats.map((s, i) => (
            <div key={i} className="pi-stat" style={{ flex: 1, minWidth: 0, padding: '17px 22px', borderLeft: i ? '1px solid rgba(14,16,22,.06)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 }}>
                <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: '#F1F0FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><s.icon size={15} color="#5B53E0" /></span>
                <StatDelta d={s.delta} />
              </div>
              <div className="pi-statv" style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', color: '#0E1016' }}>{s.v}</div>
              <div style={{ fontSize: 12, color: '#8A909C', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* best time to post */}
        {postingTimes.some((b) => b.posts > 0) && (
          <div style={{ padding: '18px 22px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8A909C' }}>Best time to post</span>
              {d.bestTime && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#5B53E0', background: '#F1F0FE', border: '1px solid rgba(91,83,224,.2)', borderRadius: 999, padding: '4px 11px' }}><Clock size={12} /> Peak {d.bestTime}</span>
              )}
            </div>
            <PostingLineChart data={postingTimes} peakLabel={peakLabel} caption={`Average views by time of day, from ${postCount} of your posts.`} />
          </div>
        )}
      </div>

      {/* what's working */}
      <div style={{ ...CARD, padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: '#0E1016' }}>What's working</span>
          <span style={{ fontSize: 12, color: '#8A909C' }}>ranked vs your own average</span>
        </div>
        {vis.map((m, i) => <Row key={i} m={m} idx={i + 1} />)}
        {hid.length > 0 && open && hid.map((m, i) => <Row key={`h${i}`} m={m} idx={vis.length + i + 1} />)}
        {hid.length > 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: '100%', cursor: 'pointer', marginTop: 4, padding: '13px 0 2px', border: 'none', borderTop: '1px solid rgba(14,16,22,.06)', background: 'transparent', color: '#545A66', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
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
              <div style={{ marginTop: 11, fontSize: 13, fontWeight: 500, color: '#5B53E0' }}>{watch.recommendation}</div>
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
