import { BarChart3 } from 'lucide-react'
import type { AggregateResults } from '@/lib/results/report'

// Brand-facing aggregate of self-reported results (per campaign or brand-wide).
// Free feature. Renders nothing loud when there's no data yet — a calm prompt.
const fmt = (n: number | null) => (n == null ? '–' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const pct = (n: number | null) => (n == null ? '–' : `${(n * 100).toFixed(1)}%`)

export default function ResultsSummary({ agg, reportedOf, title = 'Reported results' }: { agg: AggregateResults; reportedOf?: string; title?: string }) {
  const tiles: { label: string; value: string }[] = [
    { label: 'Views', value: fmt(agg.views) },
    { label: 'Reach', value: fmt(agg.reach) },
    { label: 'Engagement', value: fmt(agg.engagement) },
    { label: 'Eng. rate', value: pct(agg.engagementRate) },
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
          <div className="cl-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {tiles.map((t) => (
              <div key={t.label} style={{ background: 'var(--surface-2, #F7F8FC)', border: '1px solid rgba(20,30,80,.07)', borderRadius: 11, padding: '11px 13px' }}>
                <div className="mono-num" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>{t.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>{t.label}</div>
              </div>
            ))}
          </div>
          {reportedOf && <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', margin: '10px 0 0' }}>{reportedOf}</p>}
        </>
      )}
    </div>
  )
}
