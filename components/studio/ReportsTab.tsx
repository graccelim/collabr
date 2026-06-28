'use client'
import { useState } from 'react'
import { FileText, ChevronRight, TrendingUp, BarChart3, Clock } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import PlatformSwitcher from '@/components/studio/PlatformSwitcher'
import type { Insight } from '@/lib/analytics/insights'

// Reports — PER PLATFORM (matches Insights). A platform switcher drives a dark
// "this week" report card derived from that platform's own deterministic insights:
// engagement / top format / best time (desktop tiles, mobile metric tabs) + next
// moves. Earlier reports (the creator-level archive) list below.
const GRID = 'linear-gradient(118deg,#0A0C22 0%,#181E45 58%,#0A0C22 100%)'
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)',
  backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)', maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)',
}
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"
const GREEN = '#157A55', SLATE = '#1E2A4A', AMBER = '#B26B00', MUTED = '#8A909C'
const ORDER = ['tiktok', 'instagram', 'youtube']
const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }
const TIME_WORD: Record<string, string> = {
  '12 to 4am': 'Late night', '4 to 8am': 'Early morning', '8am to 12pm': 'Morning',
  '12 to 4pm': 'Afternoon', '4 to 8pm': 'Evening', '8pm to 12am': 'Evening',
}

type Row = { platform: string; data: any; ai_narrative: string | null }
type Report = { period_start: string; period_end: string; report: any }
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const beforeColon = (s: string) => (s || '').split(':')[0].trim()
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const fmtRange = (a: string, b: string) => `${fmtDate(a)} to ${new Date(b + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
function pick(all: Insight[], key: string) {
  return all.filter((i) => i.key === key).sort((a, b) => RANK[b.confidence] - RANK[a.confidence])[0] || null
}

export default function ReportsTab({ platformInsights, reports }: { platformInsights: Row[]; reports: Report[] }) {
  const rows = [...platformInsights].sort((a, b) => ORDER.indexOf(a.platform) - ORDER.indexOf(b.platform))
  const [active, setActive] = useState(rows[0]?.platform ?? '')
  const [metric, setMetric] = useState(0)
  const [open, setOpen] = useState<number | null>(null)

  if (!rows.length && !reports.length) {
    return <EmptyState icon={FileText} title="Weekly reports appear here" body="Once your accounts are syncing, Collabr builds a weekly digest of what changed, your strongest patterns, and your next moves, for each platform." />
  }

  const row = rows.find((r) => r.platform === active) ?? rows[0]
  const ins: Insight[] = (row?.data?.insights as Insight[]) || []
  const fmtIns = pick(ins, 'best_format') || pick(ins, 'best_style') || pick(ins, 'best_category')
  const engIns = ins.filter((i) => i.you != null && i.base != null).sort((a, b) => (b.you! - b.base!) - (a.you! - a.base!))[0]
  const delta = engIns && engIns.you != null && engIns.base != null ? engIns.you - engIns.base : null
  const bestTime: string | null = row?.data?.bestTime ?? null

  const metrics = [
    { label: 'Engagement', icon: TrendingUp, color: GREEN, value: delta != null ? `+${delta.toFixed(1)} pts` : '—', sub: 'above your average', note: engIns?.why || 'Not enough data yet for an engagement read.' },
    { label: 'Top format', icon: BarChart3, color: SLATE, value: fmtIns ? cap(beforeColon(fmtIns.evidence)) : '—', sub: fmtIns ? 'held above your baseline' : 'not enough data', note: fmtIns?.why || 'A few more posts and we can call your best format.' },
    { label: 'Best time', icon: Clock, color: SLATE, value: bestTime ? (TIME_WORD[bestTime] || bestTime) : '—', sub: bestTime || 'best window', note: bestTime ? `Posting in the ${bestTime} window is your most reliable.` : 'Best posting time appears once more posts sync.' },
  ]

  // Next moves: top content recommendations + the cooling-topic watch, if any.
  const watch = ins.find((i) => i.key === 'declining_category')
  const seen = new Set<string>()
  const moves: { text: string; color: string }[] = []
  for (const i of ins.filter((x) => x.you != null && x.key !== 'declining_category').sort((a, b) => RANK[b.confidence] - RANK[a.confidence])) {
    if (!seen.has(i.recommendation)) { seen.add(i.recommendation); moves.push({ text: i.recommendation, color: '#5B53E0' }) }
    if (moves.length >= 3) break
  }
  if (watch && !seen.has(watch.recommendation)) moves.unshift({ text: watch.recommendation, color: AMBER })

  const takeaway = row?.ai_narrative || (engIns ? `${engIns.title}.` : 'Your weekly read appears here as more posts sync.')
  const today = new Date()
  const start = new Date(today.getTime() - 6 * 86_400_000)
  const periodLabel = `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const reportType = (r: Report) => (Math.round((new Date(r.period_end).getTime() - new Date(r.period_start).getTime()) / 86_400_000) > 12 ? 'Monthly' : 'Weekly')

  const Tile = ({ m }: { m: typeof metrics[number] }) => (
    <div style={{ flex: 1, minWidth: 0, padding: '15px 16px', background: '#F7F8FC', border: '1px solid rgba(20,30,80,.07)', borderRadius: 13 }}>
      <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>{m.label}</div>
      <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 23, fontWeight: 700, letterSpacing: '-.02em', color: m.color }}>{m.value}</div>
      <div style={{ fontSize: 11.5, color: '#A2A8B6', marginTop: 3 }}>{m.sub}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {rows.length > 1 && <PlatformSwitcher platforms={rows.map((r) => r.platform)} active={row.platform} onSelect={(p) => { setActive(p); setMetric(0) }} />}

      {row && (
        <div style={{ ...CARD, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(14,16,22,.04),0 22px 48px -30px rgba(20,30,80,.32)' }}>
          {/* dark header */}
          <div style={{ position: 'relative', padding: '20px 24px', background: GRID, overflow: 'hidden' }}>
            <div style={TEXTURE} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9AA0D6', marginBottom: 7 }}>This week</div>
                <div style={{ fontFamily: NUM, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>{periodLabel}</div>
                <div style={{ fontSize: 13, color: '#9CA2D6', marginTop: 7, maxWidth: 440, lineHeight: 1.5 }}>{takeaway}</div>
              </div>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9AA0D6', border: '1px solid rgba(255,255,255,.2)', borderRadius: 999, padding: '5px 11px' }}>Weekly</span>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {/* desktop: 3 tiles */}
            <div className="hidden md:flex" style={{ gap: 12, marginBottom: 22 }}>
              {metrics.map((m, i) => <Tile key={i} m={m} />)}
            </div>

            {/* mobile: metric tab switcher + full-width panel */}
            <div className="md:hidden" style={{ marginBottom: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: '#F1F3F7', borderRadius: 11, padding: 4, marginBottom: 12 }}>
                {metrics.map((m, i) => (
                  <button key={i} type="button" onClick={() => setMetric(i)}
                    style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 600, background: i === metric ? '#fff' : 'transparent', color: i === metric ? '#0E1016' : '#8A909C', boxShadow: i === metric ? '0 1px 3px rgba(14,16,22,.12)' : 'none' }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{ padding: 18, background: '#F7F8FC', border: '1px solid rgba(20,30,80,.07)', borderRadius: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED }}>{metrics[metric].label}</span>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: `${metrics[metric].color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(() => { const I = metrics[metric].icon; return <I size={15} color={metrics[metric].color} /> })()}</span>
                </div>
                <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: metrics[metric].color, lineHeight: 1.1 }}>{metrics[metric].value}</div>
                <div style={{ fontSize: 12.5, color: '#545A66', marginTop: 8, lineHeight: 1.5 }}>{metrics[metric].note}</div>
              </div>
            </div>

            {/* next moves */}
            {moves.length > 0 && <>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 11 }}>Next moves</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {moves.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: '#fff', border: '1px solid rgba(20,30,80,.08)', borderRadius: 11 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: m.color, flex: 'none' }} />
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: '#0E1016' }}>{m.text}</span>
                  </div>
                ))}
              </div>
            </>}
          </div>
        </div>
      )}

      {/* earlier reports */}
      {reports.length > 0 && (
        <div style={{ ...CARD, padding: '8px 22px 12px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED, padding: '16px 0 4px' }}>Earlier reports</div>
          {reports.map((r, i) => {
            const isOpen = open === i
            const text = (r.report?.text as string) || 'No detail saved for this period.'
            return (
              <div key={i} style={{ borderTop: i ? '1px solid rgba(14,16,22,.06)' : 'none' }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
                  <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 8, background: '#F1F5FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={15} color={MUTED} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#0E1016' }}>{fmtRange(r.period_start, r.period_end)}</span>
                    <span style={{ display: 'block', fontSize: 11, color: MUTED, fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase' }}>{reportType(r)}</span>
                  </span>
                  <ChevronRight size={16} color="#C4CAD6" style={{ flex: 'none', transition: 'transform .2s ease', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                </button>
                {isOpen && <div style={{ fontSize: 13, lineHeight: 1.6, color: '#3A3F4B', whiteSpace: 'pre-wrap', padding: '0 0 16px 46px' }}>{text}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
