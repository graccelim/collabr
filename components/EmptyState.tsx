import Link from 'next/link'
import type { LucideProps } from 'lucide-react'
import { Sparkles } from 'lucide-react'

interface Props {
  icon: React.ComponentType<Partial<LucideProps>>
  title: string
  body: string
  actionHref?: string
  actionLabel?: string
  /** Numbered "what happens next" pills, e.g. ['Post a campaign', 'Pick a creator', 'Fund escrow'] */
  steps?: string[]
  /** 'accent' (default) for journey starts, 'money' for payout/earnings empties */
  tone?: 'accent' | 'money'
}

/**
 * Welcoming empty state (Collabr Redesign): a colored medallion with a soft
 * halo + sparkle, encouraging copy, and optional numbered next-step pills so
 * an empty screen reads as an invitation rather than a dead end.
 */
export default function EmptyState({ icon: Icon, title, body, actionHref, actionLabel, steps, tone = 'accent' }: Props) {
  const c = tone === 'money' ? 'var(--money)' : 'var(--accent)'
  const soft = tone === 'money' ? 'var(--money-tint)' : 'var(--accent-tint)'

  return (
    <div className="empty-state">
      {/* medallion — soft halo + colored tile + spark */}
      <div style={{
        position: 'relative', width: 96, height: 96, margin: '0 auto 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle at 50% 42%, ${soft}, transparent 68%)` }} />
        <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', border: `1px solid ${soft}` }} />
        <div style={{
          width: 58, height: 58, borderRadius: 'var(--radius)',
          background: soft, color: c,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <Icon size={25} />
        </div>
        <Sparkles size={14} style={{ position: 'absolute', top: 12, right: 16, color: c, opacity: .85 }} />
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em', marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', maxWidth: 384, margin: '0 auto', lineHeight: 1.6 }}>
        {body}
      </p>

      {/* numbered "what happens next" pills */}
      {steps && steps.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {steps.map((s, i) => (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 13px 7px 8px', borderRadius: 'var(--radius-pill)',
              background: 'var(--paper-2)', border: '1px solid var(--line)',
            }}>
              <span style={{
                width: 19, height: 19, borderRadius: 99, background: c, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
              }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>{s}</span>
            </span>
          ))}
        </div>
      )}

      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary" style={{ marginTop: 22 }}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
