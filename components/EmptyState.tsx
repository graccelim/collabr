import Link from 'next/link'
import type { LucideProps } from 'lucide-react'

interface Props {
  icon: React.ComponentType<Partial<LucideProps>>
  title: string
  body: string
  actionHref?: string
  actionLabel?: string
}

export default function EmptyState({ icon: Icon, title, body, actionHref, actionLabel }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={18} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
        {body}
      </p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary" style={{ marginTop: 14 }}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
