'use client'
import { useState } from 'react'
import { FileText, ChevronRight } from 'lucide-react'
import { socialIcon } from '@/components/SocialIcon'
import EmptyState from '@/components/EmptyState'
import type { Insight } from '@/lib/analytics/insights'

// Reports — a scannable weekly digest derived DETERMINISTICALLY from the
// per-platform insights (no AI required, so it works with seeded data and no key):
// highlight tiles, next moves, by-platform. Earlier reports (the stored archive)
// are clickable and open that period's report inline.

const GRID = 'linear-gradient(118deg,#0A0C22 0%,#181E45 58%,#0A0C22 100%)'
const TEXTURE: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px)',
  backgroundSize: '26px 26px', WebkitMaskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)', maskImage: 'radial-gradient(130% 120% at 100% 0,#000,transparent 68%)',
}
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const MONO = "var(--font-mono, ui-monospace, monospace)"
const NUM = "var(--font-money, system-ui, sans-serif)"
// Professional, restrained palette — green for positive only, deep slate for neutral.
const GREEN = '#157A55', SLATE = '#1E2A4A', AMBER = '#B26B00', INK = '#0E1016', MUTED = '#8A909C'
const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }
const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

type Row = { platform: string; data: any; ai_narrative: string | null }
type Report = { period_start: string; period_end: string; report: any }

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const fmtRange = (a: string, b: string) => `${fmtDate(a)} – ${new Date(b + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

function pick(all: (Insight & { platform: string })[], key: string) {
  return all.filter((i) => i.key === key).sort((a, b) => (RANK[b.confidence] - RANK[a.confidence]) || ((b.you ?? 0) - (b.base ?? 0)) - ((a.you ?? 0) - (a.base ?? 0)))[0] || null
}
const beforeColon = (s: string) => (s || '').split(':')[0].trim()

export default function ReportsTab({ platformInsights, reports }: { platformInsights: Row[]; reports: Report[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const [metric, setMetric] = useState(0)

  const all = platformInsights.flatMap((r) => ((r.data?.insights as Insight[]) || []).map((i) => ({ ...i, platform: r.platform })))
  const hasData = all.length > 0

  if (!hasData && !reports.length) {
    return <EmptyState icon={FileText} title="Weekly reports appear here" body="Once your accounts are syncing, Collabr builds a weekly digest — what changed, your strongest patterns, and your next moves." />
  }

  // ── derive the latest digest from deterministic insights ──
  const win = pick(all, 'best_window')
  const fmt = pick(all, 'best_style') || pick(all, 'best_format') || pick(all, 'best_category')
  const trend = pick(all, 'trend')
  const engagementInsight = trend && trend.you != null ? trend : all.filter((i) => i.you != null && i.base != null).sort((a, b) => ((b.you! - b.base!) - (a.you! - a.base!)))[0]
  const delta = engagementInsight && engagementInsight.you != null && engagementInsight.base != null ? engagementInsight.you - engagementInsight.base : null

  // best time → "Evening" + "6pm–12am"
  const winRaw = win ? beforeColon(win.evidence) : ''
  const winWord = winRaw ? cap(winRaw.replace(/\s*\(.*$/, '')) : '—'
  const winSub = winRaw.match(/\(([^)]+)\)/)?.[1] || (win ? 'best window' : '')
  const fmtVal = fmt ? cap(beforeColon(fmt.evidence)) : '—'

  const tiles = [
    { label: 'Engagement', value: delta != null ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} pts` : '—', sub: 'vs your average', color: delta != null && delta >= 0 ? GREEN : delta != null ? AMBER : MUTED },
    { label: 'Top format', value: fmtVal, sub: fmt ? 'held above avg' : 'not enough data', color: SLATE },
    { label: 'Best time', value: winWord, sub: winSub, color: SLATE },
  ]

  // next moves: top recommendations (working) + a watch item if present
  const isWatch = (i: Insight) => i.key === 'declining_category' || (i.key === 'trend' && /cool|declin|easing|slip|down/i.test(i.title)) || (i.key === 'consistency' && /uneven|gap|erratic/i.test(i.title))
  const working = all.filter((i) => i.key !== 'experiment' && !isWatch(i) && i.you != null)
    .sort((a, b) => (RANK[b.confidence] - RANK[a.confidence]) || ((b.you! - b.base!) - (a.you! - a.base!)))
  const watch = all.find(isWatch)
  const seen = new Set<string>()
  const moves: { text: string; color: string }[] = []
  for (const i of working) { if (!seen.has(i.recommendation)) { seen.add(i.recommendation); moves.push({ text: i.recommendation, color: SLATE }) } if (moves.length >= 2) break }
  if (watch && !seen.has(watch.recommendation)) moves.push({ text: watch.recommendation, color: AMBER })

  const byPlatform = platformInsights.map((r) => {
    const ins = (r.data?.insights as Insight[]) || []
    const top = ins.filter((i) => i.you != null).sort((a, b) => (RANK[b.confidence] - RANK[a.confidence]))[0]
    return { platform: r.platform, note: r.data?.strongest || top?.title || 'Still learning' }
  })

  const takeaway = win && fmt
    ? `${winWord} posts and ${fmtVal.toLowerCase()} are doing the heavy lifting this week.`
    : 'Your strongest patterns this week — measured only against your own history.'

  // period: last 7 days
  const today = new Date()
  const start = new Date(today.getTime() - 6 * 86_400_000)
  const periodLabel = `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const reportType = (r: Report) => {
    const days = Math.round((new Date(r.period_end).getTime() - new Date(r.period_start).getTime()) / 86_400_000)
    return days > 12 ? 'Monthly' : 'Weekly'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* latest digest */}
      {hasData && (
        <div style={{ ...CARD, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(14,16,22,.04),0 22px 48px -30px rgba(20,30,80,.32)' }}>
          <div style={{ position: 'relative', padding: '20px 24px', background: GRID, overflow: 'hidden' }}>
            <div style={TEXTURE} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9AA0D6', marginBottom: 7 }}>This week</div>
                <div style={{ fontFamily: NUM, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>{periodLabel}</div>
                <div style={{ fontSize: 13, color: '#9CA2D6', marginTop: 7, maxWidth: 440, lineHeight: 1.5 }}>{takeaway}</div>
              </div>
              <span style={{ fontSize: 11, color: '#9AA0D6', fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,.18)', padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>Weekly</span>
            </div>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {/* metric switcher → selected metric shown full-width (no cramped 3-up) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: '#F1F3F7', borderRadius: 11, padding: 4, marginBottom: 12 }}>
              {tiles.map((t, i) => (
                <button key={i} type="button" onClick={() => setMetric(i)}
                  style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '8px 6px', fontSize: 12.5, fontWeight: 600, background: i === metric ? '#fff' : 'transparent', color: i === metric ? '#0E1016' : '#8A909C', boxShadow: i === metric ? '0 1px 3px rgba(14,16,22,.12)' : 'none' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding: '18px 20px', background: '#F7F8FC', border: '1px solid rgba(20,30,80,.07)', borderRadius: 13, marginBottom: 22 }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>{tiles[metric].label}</div>
              <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: tiles[metric].color, lineHeight: 1.1 }}>{tiles[metric].value}</div>
              <div style={{ fontSize: 12, color: '#A2A8B6', marginTop: 4 }}>{tiles[metric].sub}</div>
            </div>

            {moves.length > 0 && <>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 11 }}>Next moves</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                {moves.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: '#fff', border: '1px solid rgba(20,30,80,.08)', borderRadius: 11 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: m.color, flex: 'none' }} />
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: INK }}>{m.text}</span>
                  </div>
                ))}
              </div>
            </>}

            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 13 }}>By platform</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {byPlatform.map((p) => {
                const G = socialIcon(p.platform)
                return (
                  <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 8, background: '#F4F6FA', border: '1px solid rgba(20,30,80,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><G size={16} /></span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: INK, width: 92, flex: 'none' }}>{LABEL[p.platform] || p.platform}</span>
                    <span style={{ fontSize: 13, color: '#545A66', minWidth: 0 }}>{p.note}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* earlier reports — clickable, expand to show that period's report */}
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
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: INK }}>{fmtRange(r.period_start, r.period_end)}</span>
                    <span style={{ display: 'block', fontSize: 11, color: MUTED, fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase' }}>{reportType(r)}</span>
                  </span>
                  <ChevronRight size={16} color="#C4CAD6" style={{ flex: 'none', transition: 'transform .2s ease', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                </button>
                {isOpen && (
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: '#3A3F4B', whiteSpace: 'pre-wrap', padding: '0 0 16px 46px' }}>{text}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
