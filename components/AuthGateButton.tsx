'use client'

import { useState } from 'react'
import AuthModal from './AuthModal'

/**
 * A button that, for a logged-out visitor, opens the "Sign in to continue"
 * modal instead of performing a gated action. Used on public pages where the
 * action (apply, save, …) requires an account. Logged-in flows render their
 * real action component instead of this.
 */
export default function AuthGateButton({
  children,
  className = 'btn-primary',
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)}>
        {children}
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
