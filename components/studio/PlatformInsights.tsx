import TrendBars from '@/components/TrendBars'
import { Sparkles, TrendingUp } from 'lucide-react'

// One platform's Insights section: small overview · AI analyst's read (optional)
// · historical trend (our longitudinal memory) · grounded insight cards with
// confidence. Renders entirely from the deterministic engine; AI is overlay only.
const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1e3).toFixed(1)}k`
  return String(Math.round(v))
}
const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)

const CONF: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High confidence', color: 'var(--money-deep)', bg: 'var(--money-tint)' },
  medium: { label: 'Medium confidence', color: 'var(--accent-deep)', bg: 'var(--accent-tint)' },
  low: { label: 'Early signal', color: 'var(--ink-faint-solid)', bg: 'var(--surface-2)' },
}

export default function PlatformInsights({ row }: { row: { platform: string; data: any; ai_narrative: string | null } }) {
  const d = row.data || {}
  const ov = d.overview || {}
  const insights: any[] = Array.isArray(d.insights) ? d.insights : []
  const thin = (d.dataConfidence || 'low') === 'low' && insights.length === 0

  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{LABEL[row.platform] || row.platform}</h3>
        <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>{d.postCount ?? 0} posts analysed</span>
      </div>

      {/* Small overview — your baseline, not a dashboard */}
      <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {[['Median views', fmt(ov.medianViews)], ['Avg views', fmt(ov.avgViews)], ['Avg engagement', pct(ov.avgEngagementRate)]].map(([l, v]) => (
          <div key={l} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint-solid)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* AI analyst's read (optional overlay) */}
      {row.ai_narrative && (
        <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 10, background: 'var(--accent-tint)', marginBottom: 14 }}>
          <Sparkles size={15} color="var(--accent-deep)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>{row.ai_narrative}</p>
        </div>
      )}

      {/* Historical trend — the longitudinal memory native tools discard */}
      {Array.isArray(d.trend) && d.trend.length >= 2 && (
        <div style={{ marginBottom: 14 }}><TrendBars data={d.trend} label="Views over time (your full history)" /></div>
      )}

      {/* Winning patterns + recommendations */}
      {thin ? (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          We’re still learning your {LABEL[row.platform] || row.platform} patterns. As more posts sync, your winning
          formats, best posting windows and trends will appear here — and they keep getting sharper over time.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((ins, i) => {
            const c = CONF[ins.confidence] || CONF.low
            return (
              <div key={i} className="card" style={{ padding: '13px 15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{ins.title}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: c.color, background: c.bg, padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>{c.label}</span>
                </div>
                {ins.why && <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 4px', lineHeight: 1.45 }}>{ins.why}</p>}
                {ins.evidence && <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', margin: '0 0 4px' }}><strong>Your data:</strong> {ins.evidence}</p>}
                {ins.recommendation && <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0, fontWeight: 600 }}>→ {ins.recommendation}</p>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
