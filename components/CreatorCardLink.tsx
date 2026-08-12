'use client'
import { useState } from 'react'
import Link from 'next/link'
import AuthModal from './AuthModal'

/**
 * Wraps a discovery card. Logged-in visitors get a normal Link straight to
 * the profile. Logged-out visitors on /browse get the "sign in to continue"
 * modal instead - the card's identity is already blurred, so letting the
 * click through to a profile page that shows everything in plain text would
 * make the blur pointless (one extra click reveals it all anyway).
 */
export default function CreatorCardLink({
  href, gated, children, className, style,
}: {
  href: string
  gated?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)

  if (!gated) {
    return <Link href={href} className={className} style={style}>{children}</Link>
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={className}
        style={{ ...style, cursor: 'pointer' }}
        onClick={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
      >
        {children}
      </div>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
