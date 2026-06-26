// Consistent loading skeletons. Pure CSS shimmer (keyframes in globals.css → .cl-pulse
// reuse or inline). Use for analytics/AI panels while data loads client-side.
export function Skeleton({ height = 16, width = '100%', radius = 8, style }: {
  height?: number | string
  width?: number | string
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <span
      aria-hidden
      style={{
        display: 'block', height, width, borderRadius: radius,
        background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--line) 37%, var(--surface-2) 63%)',
        backgroundSize: '400% 100%', animation: 'cl-shimmer 1.3s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton height={14} width="40%" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '70%' : '100%'} />
      ))}
    </div>
  )
}
