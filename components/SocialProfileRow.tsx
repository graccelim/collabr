'use client'
import { useState } from 'react'
import { ExternalLink, Lock } from 'lucide-react'
import AuthModal from './AuthModal'

/**
 * One row in a creator's "Social profiles" rail. Logged-in viewers get a
 * real outbound link with the handle in plain text - that's the actual
 * verification step ("open it and check the account yourself"). Logged-out
 * visitors get the handle blurred and the link disabled (no href at all,
 * not just visually hidden) since this is a direct route around Collabr
 * entirely - clicking through would hand over exactly the DM-around-the-
 * platform shortcut the rest of the identity gate exists to prevent.
 */
export default function SocialProfileRow({
  href, icon, label, primary, handleLabel, followerText, gated,
}: {
  href: string
  icon: React.ReactNode
  label: string
  primary?: boolean
  handleLabel: string
  followerText?: string | null
  gated?: boolean
}) {
  const [open, setOpen] = useState(false)

  const content = (
    <>
      <span style={{ width: 26, flexShrink: 0, display: 'grid', placeItems: 'center' }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
          {primary && <span className="badge badge-accent" style={{ fontSize: 9.5, padding: '1px 6px' }}>Primary</span>}
        </span>
        <span
          style={{
            display: 'block', fontSize: 12, color: 'var(--ink-faint-solid)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            ...(gated ? { filter: 'blur(4px)', userSelect: 'none' as const } : {}),
          }}
        >
          {handleLabel}{followerText || ''}
        </span>
      </span>
      {gated
        ? <Lock size={14} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
        : <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />}
    </>
  )

  if (!gated) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="rail-link">{content}</a>
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="rail-link"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
      >
        {content}
      </div>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
