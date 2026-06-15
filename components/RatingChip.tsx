import { Star } from 'lucide-react'

/**
 * Honest reputation chip used wherever one party evaluates another (job detail,
 * collab page). Shows the earned star average + review count, or a neutral
 * "New to collabr" before any reviews exist — never a fabricated score.
 */
export default function RatingChip({
  avg, count, label = 'New to collabr', size = 13,
}: { avg?: number | null; count?: number | null; label?: string; size?: number }) {
  const n = count || 0
  if (n < 1) {
    return (
      <span className="badge badge-neutral" style={{ fontSize: size - 1.5 }}>{label}</span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: size, color: 'var(--ink-soft)' }}>
      <Star size={size + 1} fill="currentColor" style={{ color: 'var(--warn)' }} />
      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{Number(avg).toFixed(1)}</span>
      <span style={{ color: 'var(--ink-faint-solid)' }}>· {n} review{n !== 1 ? 's' : ''}</span>
    </span>
  )
}
