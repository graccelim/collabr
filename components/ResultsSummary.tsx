import { BarChart3, Eye, Heart, Activity, Percent } from 'lucide-react'
import type { AggregateResults } from '@/lib/results/report'

// Brand-facing aggregate of self-reported results (per campaign or brand-wide).
// Free feature. Renders nothing loud when there's no data yet — a calm prompt.
const fmt = (n: number | null) => (n == null ? '–' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const pct = (n: number | null) => (n == null ? '–' : `${(n * 100).toFixed(1)}%`)

export default function ResultsSummary({ agg, reportedOf, title = 'Reported results' }: { agg: AggregateResults; reportedOf?: string; title?: string }) {
  const tiles: { label: string; value: string; Icon: typeof Eye }[] = [
    { label: 'Views', value: fmt(agg.views), Icon: Eye },
    { label: 'Likes', value: fmt(agg.likes), Icon: Heart },
    { label: 'Engagement', value: fmt(agg.engagement), Icon: Activity },
    { label: 'Eng. rate', value: pct(agg.engagementRate), Icon: Percent },
  ]

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <BarChart3 size={16} style={{ color: 'var(--accent-deep, #2A3157)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h3>
        </div>
        <span className="badge badge-neutral" style={{ fontSize: 11 }}>Self-reported</span>
      </div>

      {agg.reportedCount === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
          Numbers appear here as your creators report how their posts performed.
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            {tiles.map((t) => (
              <div key={t.label} style={{ background: 'linear-gradient(140deg,#EEF3FD,#F6F9FF)', border: '1px solid rgba(40,90,190,.12)', borderRadius: 11, padding: '11px 12px' }}>
                <div className="mono-num" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>{t.value}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <t.Icon size={12} style={{ color: 'var(--accent-deep, #5B6191)', flex: 'none' }} />
                  <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{t.label}</span>
                </div>
              </div>
            ))}
          </div>
          {reportedOf && <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', margin: '10px 0 0' }}>{reportedOf}</p>}
        </>
      )}
    </div>
  )
}
