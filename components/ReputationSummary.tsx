import { Star, Users, CheckCircle2, Sparkles } from 'lucide-react'
import Link from 'next/link'

/**
 * Level-2 reputation block - a calm trust summary used on profiles (public and
 * "how you appear to others"). Shows earned signals only; for a brand-new
 * account it shows a premium, non-suspicious empty state instead of zeros.
 * Pass ctaHref/ctaLabel for an owner-facing call to action.
 */
export default function ReputationSummary({
  ratingAvg, ratingCount, completed, completedLabel = 'completed collaborations',
  emptyTitle = 'New to collabr', emptyBody = 'Reputation is built through completed collaborations. Reviews appear once both sides submit, or after 7 days.',
  ctaHref, ctaLabel,
}: {
  ratingAvg?: number | null
  ratingCount?: number | null     // distinct collaborators
  completed?: number | null
  completedLabel?: string
  emptyTitle?: string
  emptyBody?: string
  ctaHref?: string
  ctaLabel?: string
}) {
  const collaborators = ratingCount || 0
  const done = completed || 0
  const hasReputation = collaborators >= 1 || done >= 1

  if (!hasReputation) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: 'var(--accent-tint)', color: 'var(--accent-deep)',
          display: 'grid', placeItems: 'center',
        }}>
          <Sparkles size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{emptyTitle}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 1 }}>{emptyBody}</div>
        </div>
        {ctaHref && ctaLabel && (
          <Link href={ctaHref} className="btn-primary" style={{ flexShrink: 0 }}>{ctaLabel}</Link>
        )}
      </div>
    )
  }

  const items: { icon: typeof Star; value: string; label: string }[] = []
  if (collaborators >= 1) {
    items.push({ icon: Star, value: `${Number(ratingAvg).toFixed(1)}`, label: 'average rating' })
    items.push({ icon: Users, value: String(collaborators), label: `collaborator${collaborators !== 1 ? 's' : ''}` })
  }
  if (done >= 1) items.push({ icon: CheckCircle2, value: String(done), label: completedLabel })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
      {items.map(({ icon: Icon, value, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon size={16} style={{ color: label === 'average rating' ? 'var(--warn)' : 'var(--ink-faint-solid)', flexShrink: 0 }}
            fill={label === 'average rating' ? 'currentColor' : 'none'} />
          <span>
            <span className="mono-num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginLeft: 6 }}>{label}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
