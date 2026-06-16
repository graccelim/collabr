import { Star, Sparkles } from 'lucide-react'

/**
 * Colourful rating summary - big average + star-distribution bars (Airbnb-style).
 * `distribution[i]` = number of reviews with rating (i+1). Premium empty state
 * for new accounts (never "0.0"). Responsive: stacks on mobile.
 */
export default function RatingSummaryCard({
  avg, count, distribution, totalReviews,
  emptyTitle = 'New to collabr',
  emptyBody = 'Reviews appear here after completed collaborations, revealed once both sides submit, or after 7 days.',
}: {
  avg?: number | null
  count?: number | null          // distinct collaborators
  distribution: number[]         // length 5, index 0 = 1★ … 4 = 5★
  totalReviews: number
  emptyTitle?: string
  emptyBody?: string
}) {
  if ((count || 0) < 1 && totalReviews < 1) {
    return (
      <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
          <Sparkles size={20} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{emptyTitle}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 2 }}>{emptyBody}</div>
        </div>
      </div>
    )
  }

  const max = Math.max(1, ...distribution)
  return (
    <div className="card rep-summary" style={{ padding: 22, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 26, alignItems: 'center' }}>
      {/* big average */}
      <div style={{ textAlign: 'center', paddingRight: 26, borderRight: '1px solid var(--line)' }}>
        <div className="mono-num" style={{ fontFamily: 'var(--font-grotesk)', fontSize: 46, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1 }}>
          {Number(avg).toFixed(1)}
        </div>
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} size={15} fill={s <= Math.round(Number(avg)) ? 'currentColor' : 'none'}
              style={{ color: s <= Math.round(Number(avg)) ? 'var(--warn)' : 'var(--line-strong)' }} />
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 8, whiteSpace: 'nowrap' }}>
          from {count} collaborator{count !== 1 ? 's' : ''}
        </div>
      </div>

      {/* distribution bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[5, 4, 3, 2, 1].map(star => {
          const n = distribution[star - 1] || 0
          return (
            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: 'var(--ink-soft)', width: 26, flexShrink: 0 }}>
                {star}<Star size={10} fill="currentColor" style={{ color: 'var(--warn)' }} />
              </span>
              <div style={{ flex: 1, height: 7, borderRadius: 99, background: 'var(--paper-2)', overflow: 'hidden' }}>
                <div style={{ width: `${(n / max) * 100}%`, height: '100%', borderRadius: 99, background: n > 0 ? 'var(--warn)' : 'transparent' }} />
              </div>
              <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-faint-solid)', width: 18, textAlign: 'right', flexShrink: 0 }}>{n}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
