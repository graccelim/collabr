'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

/**
 * "Sign in to continue" modal shown when a logged-out visitor triggers a gated
 * action (apply, save, invite, message, create campaign). Viewing is never
 * gated - only the action is. Both auth links carry ?next=<current path> so the
 * visitor lands back on the exact page after authenticating; "Continue
 * browsing" just closes.
 */
export default function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() || '/'
  const next = encodeURIComponent(pathname)

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log in to continue"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'grid', placeItems: 'center', padding: 16,
        background: 'rgba(0,4,53,0.45)', backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 420, width: '100%', padding: '28px 26px', position: 'relative', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', maxHeight: '90dvh', overflowY: 'auto' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, width: 30, height: 30,
            display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer',
            borderRadius: 8, background: 'transparent', color: 'var(--ink-faint-solid)',
          }}
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          Log in to continue
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.55 }}>
          Create a free account to apply for campaigns, invite creators, save opportunities, and manage collaborations.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          <Link href={`/signup?next=${next}`} className="btn-primary btn-block" style={{ justifyContent: 'center' }}>
            Join free
          </Link>
          <Link href={`/login?next=${next}`} className="btn-secondary btn-block" style={{ justifyContent: 'center' }}>
            Log in
          </Link>
          <button type="button" onClick={onClose} className="btn-ghost btn-block" style={{ justifyContent: 'center' }}>
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  )
}
