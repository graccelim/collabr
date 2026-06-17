import { MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { relativeTime, getInitials } from '@/lib/utils'

export interface ReviewItem {
  id: string
  rating: number
  note: string | null
  title?: string | null              // campaign / collab title
  author?: string | null             // who wrote it (brand or creator name)
  authorRole?: 'brand' | 'creator'   // for the role pill
  when?: string | null               // created_at
}

// Rotating avatar tints - warm, on-brand pops of colour.
const TINTS = [
  { bg: 'var(--accent-tint)', fg: 'var(--accent-deep)', bar: 'var(--accent)' },
  { bg: 'var(--money-tint)', fg: 'var(--money-deep)', bar: 'var(--money)' },
  { bg: 'var(--warn-tint)', fg: 'var(--warn-deep)', bar: 'var(--warn)' },
  { bg: 'var(--creator-tint)', fg: 'var(--creator-deep)', bar: 'var(--creator)' },
]

export default function ReviewList({
  reviews, heading = 'Reviews',
  emptyTitle = 'No reviews yet',
  emptyBody = 'Reviews show up after a collab wraps. Both sides write theirs in private, and they appear once you\'ve both submitted, or after 7 days.',
  ctaHref, ctaLabel,
}: {
  reviews: ReviewItem[]
  heading?: string
  emptyTitle?: string
  emptyBody?: string
  ctaHref?: string
  ctaLabel?: string
}) {
  return (
    <section style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 className="h2" style={{ fontSize: 18, margin: 0 }}>{heading}</h2>
        {reviews.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
            {reviews.length} total
          </span>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
            <MessageSquare size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{emptyTitle}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 1 }}>{emptyBody}</div>
          </div>
          {ctaHref && ctaLabel && (
            <Link href={ctaHref} className="btn-primary" style={{ flexShrink: 0 }}>{ctaLabel}</Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map((r, i) => {
            const tint = TINTS[i % TINTS.length]
            const author = r.author || 'Collaborator'
            return (
              <div key={r.id} className="card" style={{ position: 'relative', overflow: 'hidden', paddingLeft: 20 }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: tint.bar }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: tint.bg, color: tint.fg, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>
                      {getInitials(author)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{author}</span>
                        {r.authorRole && (
                          <span className="badge badge-safe" style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                            {r.authorRole}
                          </span>
                        )}
                      </div>
                      {r.title && (
                        <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 1 }}>
                          via <span style={{ color: 'var(--accent-deep)', fontWeight: 500 }}>{r.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <span aria-label={`${r.rating} out of 5`} style={{ fontSize: 13, color: 'var(--warn)', letterSpacing: 1 }}>
                      {'★'.repeat(r.rating)}<span style={{ color: 'var(--line-strong)' }}>{'★'.repeat(5 - r.rating)}</span>
                    </span>
                    {r.when && <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>{relativeTime(r.when)}</span>}
                  </div>
                </div>
                {r.note && (
                  <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '12px 0 0' }}>
                    &ldquo;{r.note}&rdquo;
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
