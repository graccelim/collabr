import { Star } from 'lucide-react'

/**
 * Honest reputation chip used wherever one party evaluates another (job detail,
 * collab page). `count` is DISTINCT collaborators (anti-farming: repeat reviews
 * from the same pair don't inflate it). Shows the earned average + collaborator
 * count, or a neutral "New to collabr" before any reviews — never a fake score.
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
      <span style={{ color: 'var(--ink-faint-solid)' }}>· {n} collaborator{n !== 1 ? 's' : ''}</span>
    </span>
  )
}
