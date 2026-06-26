// Minimal deterministic trend chart (CSS bars) for {date, views}[] series.
// Self-contained, no deps. Renders nothing for empty/one-point series.
export default function TrendBars({ data, label = 'Total views over time' }: {
  data: { date: string; views: number }[] | null | undefined
  label?: string
}) {
  const series = (data ?? []).filter((d) => d && typeof d.views === 'number')
  if (series.length < 2) return null
  const max = Math.max(...series.map((d) => d.views), 1)
  const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1_000 ? `${(n / 1e3).toFixed(1)}k` : String(n))

  return (
    <div>
      <div className="eyebrow" style={{ fontSize: 10, color: 'var(--ink-faint-solid)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
        {series.slice(-30).map((d, i) => (
          <div key={i} title={`${d.date}: ${fmt(d.views)} views`}
            style={{
              flex: 1, height: `${Math.max(4, (d.views / max) * 100)}%`,
              background: 'linear-gradient(180deg, var(--accent), var(--accent-tint))',
              borderRadius: 3, minWidth: 3,
            }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint-solid)', marginTop: 6 }}>
        <span>{series[Math.max(0, series.length - 30)]?.date}</span>
        <span>{series[series.length - 1]?.date} · {fmt(series[series.length - 1]?.views)} views</span>
      </div>
    </div>
  )
}
