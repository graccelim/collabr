'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Minimal top chrome for logged-out visitors on public pages (profiles,
 * campaigns). Logo + Log in + Join free. The auth links carry ?next= so the
 * visitor lands back on the exact page they were viewing after authenticating.
 */
export default function PublicHeader() {
  const pathname = usePathname() || '/'
  const next = encodeURIComponent(pathname)
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 20px',
        background: 'rgba(241,245,252,0.85)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <Link
        href="/"
        style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em', color: 'var(--accent)' }}
      >
        collabr<span style={{ color: 'var(--money)' }}>.</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          href={`/login?next=${next}`}
          className="btn-ghost"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          Log in
        </Link>
        <Link
          href={`/signup?next=${next}`}
          className="btn-primary"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          Join free
        </Link>
      </div>
    </header>
  )
}
