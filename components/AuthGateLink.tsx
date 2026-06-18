'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthModal from './AuthModal'

/**
 * A link that navigates for a signed-in user but opens the "Sign in to
 * continue" modal for a guest — used on public/shared pages so a logged-out
 * visitor is never hard-bounced to /login when they tap something that leads
 * into the gated app.
 */
export default function AuthGateLink({
  href,
  authed,
  className,
  style,
  children,
}: {
  href: string
  authed: boolean
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  if (authed) {
    return <Link href={href} className={className} style={style}>{children}</Link>
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', ...style }}
      >
        {children}
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
