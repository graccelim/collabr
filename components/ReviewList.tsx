import { MessageSquare } from 'lucide-react'

export interface ReviewItem {
  id: string
  rating: number
  note: string | null
  title?: string | null   // campaign / collab title
}

/**
 * Level-3 revealed-review list with a premium empty state. Only ever receives
 * already-revealed reviews (double-blind is enforced in the backend/RLS).
 */
export default function ReviewList({
  reviews, heading = 'Reviews',
  emptyTitle = 'No reviews yet',
  emptyBody = 'Feedback appears after completed collaborations — revealed once both sides submit, or after 7 days.',
}: {
  reviews: ReviewItem[]
  heading?: string
  emptyTitle?: string
  emptyBody?: string
}) {
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>{heading}</h2>
      {reviews.length === 0 ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 18 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'var(--surface-2)', color: 'var(--ink-soft)', display: 'grid', placeItems: 'center',
          }}>
            <MessageSquare size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{emptyTitle}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 1 }}>{emptyBody}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map(r => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: r.note ? 6 : 0 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>{r.title || 'Collaboration'}</span>
                <span aria-label={`${r.rating} out of 5`} style={{ fontSize: 13, color: 'var(--warn)', letterSpacing: 1 }}>
                  {'★'.repeat(r.rating)}<span style={{ color: 'var(--line-strong)' }}>{'★'.repeat(5 - r.rating)}</span>
                </span>
              </div>
              {r.note && <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>{r.note}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
