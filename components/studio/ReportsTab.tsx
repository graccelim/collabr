'use client'
import { useState } from 'react'
import { FileText, ChevronRight, Play, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import PlatformSwitcher from '@/components/studio/PlatformSwitcher'
import PostingBars from '@/components/studio/PostingBars'
import type { Insight, WeeklyReport } from '@/lib/analytics/insights'

// Reports — a weekly digest per platform: headline + 4 stat cards (vs last week),
// daily rhythm, top post, category movement, next moves, and earlier reports.
const GRID = 'linear-gradient(118deg,#0A0C22 0%,#181E45 58%,#0A0C22 100%)'
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)',
  backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)', maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)',
}
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"
const MUTED = '#8A909C', GREEN = '#0F7A4D', RED = '#B4332B'
const ORDER = ['tiktok', 'instagram', 'youtube']
const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

type Row = { platform: string; data: any; ai_narrative: string | null }
type Report = { period_start: string; period_end: string; report: any }

const fmtViews = (v: number | null | undefined) => (v == null ? '—' : v >= 1000 ? `${(v / 1000) % 1 === 0 ? v / 1000 : (v / 1000).toFixed(1)}k` : String(Math.round(v)))
const fmtPct = (f: number | null | undefined) => (f == null ? '—' : `${(f * 100).toFixed(1)}%`)
const fmtRange = (a: string, b: string) => `${new Date(a + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${new Date(b + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

// kind: pct (fraction → %), pts (rate diff → points), count (absolute integer)
function Delta({ value, kind }: { value: number | null | undefined; kind: 'pct' | 'pts' | 'count' }) {
  if (value == null) return null
  const up = value >= 0
  const col = kind === 'count' && value === 0 ? MUTED : up ? GREEN : RED
  const bg = kind === 'count' && value === 0 ? '#F1F3F7' : up ? '#EAF4EE' : '#FBEDEC'
  const txt = kind === 'pct' ? `${Math.abs(value * 100).toFixed(0)}%` : kind === 'pts' ? `${Math.abs(value * 100).toFixed(1)} pts` : `${value > 0 ? '+' : ''}${value}`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 11.5, fontWeight: 700, color: col, background: bg, borderRadius: 999, padding: '3px 8px' }}>
      {kind !== 'count' && (up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}{txt}
    </span>
  )
}

function pick(all: Insight[], key: string) {
  return all.filter((i) => i.key === key).sort((a, b) => RANK[b.confidence] - RANK[a.confidence])[0] || null
}

export default function ReportsTab({ platformInsights, reports }: { platformInsights: Row[]; reports: Report[] }) {
  const rows = [...platformInsights].sort((a, b) => ORDER.indexOf(a.platform) - ORDER.indexOf(b.platform))
  const [active, setActive] = useState(rows[0]?.platform ?? '')
  const [open, setOpen] = useState<number | null>(null)

  if (!rows.length && !reports.length) {
    return <EmptyState icon={FileText} title="Weekly reports appear here" body="Once your accounts are syncing, Collabr builds a weekly digest of what changed, your strongest patterns, and your next moves, for each platform." />
  }

  const row = rows.find((r) => r.platform === active) ?? rows[0]
  const rep = (row?.data?.report as WeeklyReport | undefined)
  const ins: Insight[] = (row?.data?.insights as Insight[]) || []

  // headline takeaway (first two sentences of the analyst read)
  const rawTakeaway = row?.ai_narrative || 'Your weekly read appears here as more posts sync.'
  const takeaway = (rawTakeaway.match(/[^.!?]+[.!?]+/g) || [rawTakeaway]).slice(0, 2).join(' ').trim()
  const today = new Date()
  const start = new Date(today.getTime() - 6 * 86_400_000)
  const periodLabel = `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const w = rep?.weekly
  const useShares = w && (w.saves == null) && (w.shares != null)
  const stats = w ? [
    { label: 'Views', value: fmtViews(w.views), delta: w.viewsDelta, kind: 'pct' as const },
    { label: 'Engagement', value: fmtPct(w.engagement), delta: w.engDelta, kind: 'pts' as const },
    { label: 'Posts', value: String(w.posts), delta: w.postsDelta, kind: 'count' as const },
    useShares
      ? { label: 'Shares', value: fmtViews(w.shares), delta: w.sharesDelta, kind: 'pct' as const }
      : { label: 'Saves', value: fmtViews(w.saves), delta: w.savesDelta, kind: 'pct' as const },
  ] : []

  // Forward-looking next moves (from the engine), not a repeat of "what's working".
  const moves: string[] = rep?.nextMoves ?? []

  const topPost = rep?.topPost
  const reportType = (r: Report) => (Math.round((new Date(r.period_end).getTime() - new Date(r.period_start).getTime()) / 86_400_000) > 12 ? 'Monthly' : 'Weekly')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.length > 1 && <PlatformSwitcher platforms={rows.map((r) => r.platform)} active={row.platform} onSelect={(p) => { setActive(p); setOpen(null) }} />}

      {row && (
        <>
          {/* this week header */}
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '20px 22px', background: GRID, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 22px 48px -30px rgba(20,30,80,.32)' }}>
            <div style={TEXTURE} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9AA0D6', marginBottom: 8 }}>This week</div>
                <div style={{ fontFamily: NUM, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>{periodLabel}</div>
                <div style={{ fontSize: 13, color: '#9CA2D6', marginTop: 8, maxWidth: 560, lineHeight: 1.5 }}>{takeaway}</div>
              </div>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9AA0D6', border: '1px solid rgba(255,255,255,.2)', borderRadius: 999, padding: '5px 11px' }}>Weekly</span>
            </div>
          </div>

          {/* 4 stat cards */}
          {stats.length > 0 && (
            <div className="rep-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {stats.map((s, i) => (
                <div key={i} style={{ ...CARD, padding: '15px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 9 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED }}>{s.label}</span>
                    <Delta value={s.delta} kind={s.kind} />
                  </div>
                  <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', color: '#0E1016' }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, color: '#A2A8B6', marginTop: 2 }}>vs last week</div>
                </div>
              ))}
            </div>
          )}

          {/* daily rhythm + top post */}
          <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {rep?.dailyRhythm?.some((d) => d.posts > 0) && (
              <div style={{ ...CARD, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0E1016' }}>Daily rhythm</span>
                  {rep.bestDay && <span style={{ fontSize: 12, color: '#2A3157', fontWeight: 600 }}>{rep.bestDay} strongest</span>}
                </div>
                <PostingBars data={rep.dailyRhythm.map((d) => ({ label: d.label[0], avgViews: d.avgViews, posts: d.posts }))} height={120} />
              </div>
            )}

            {topPost && (
              <div style={{ ...CARD, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0E1016' }}>Top post this week</span>
                  {topPost.durationSec != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#5B53E0', background: '#F1F0FE', border: '1px solid rgba(91,83,224,.2)', borderRadius: 999, padding: '3px 9px' }}>Preview · {Math.round(topPost.durationSec)}s</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 11, background: '#0A0C22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={16} color="#fff" fill="#fff" /></span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0E1016', lineHeight: 1.4 }}>{topPost.title || 'Your best-performing post'}</span>
                </div>
                <div style={{ display: 'flex', gap: 18 }}>
                  {[['Views', fmtViews(topPost.views)], ['Engagement', fmtPct(topPost.engagement)], [useShares ? 'Shares' : 'Saves', fmtViews(useShares ? topPost.shares : topPost.saves)]].map(([l, v], i) => (
                    <div key={i}>
                      <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 17, fontWeight: 700, color: '#0E1016' }}>{v}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* next moves — full width, the actionable payoff */}
          {moves.length > 0 && (
            <div style={{ ...CARD, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>Your next moves</span>
                <span style={{ fontSize: 12, color: MUTED }}>experiments to try this week</span>
              </div>
              <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {moves.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', background: '#F7F8FC', border: '1px solid rgba(20,30,80,.07)', borderRadius: 11 }}>
                    <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 7, background: '#fff', border: '1px solid rgba(20,30,80,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, color: '#5C6191' }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: '#0E1016', lineHeight: 1.4 }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* earlier reports */}
      {reports.length > 0 && (
        <div style={{ ...CARD, padding: '8px 20px 12px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED, padding: '14px 0 4px' }}>Earlier reports</div>
          {reports.map((r, i) => {
            const isOpen = open === i
            const text = (r.report?.text as string) || 'No detail saved for this period.'
            return (
              <div key={i} style={{ borderTop: i ? '1px solid rgba(14,16,22,.06)' : 'none' }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0' }}>
                  <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 8, background: '#F1F5FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={14} color={MUTED} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#0E1016' }}>{fmtRange(r.period_start, r.period_end)}</span>
                    <span style={{ display: 'block', fontSize: 11, color: MUTED, fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase' }}>{reportType(r)}</span>
                  </span>
                  <ChevronRight size={16} color="#C4CAD6" style={{ flex: 'none', transition: 'transform .2s ease', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                </button>
                {isOpen && <div style={{ fontSize: 13, lineHeight: 1.6, color: '#3A3F4B', whiteSpace: 'pre-wrap', padding: '0 0 14px 44px' }}>{text}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
