'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, Plus, Compass, LogOut } from 'lucide-react'

interface Props {
  role: 'brand' | 'creator'
  /** Unread notifications — drives the bell dot. */
  notificationBadge?: number
  /** For the mobile account menu (sidebar is hidden on mobile). */
  displayName?: string
  email?: string
  initials?: string
}

/**
 * Persistent app top bar (Collabr Redesign): a semantic escrow badge + the
 * beta context strip on the left, quick search / notifications / the primary
 * workspace action on the right. Sticks under the scroll container with a
 * blurred canvas backdrop. Framer drives the icon-button + CTA micro-presses.
 */
export default function TopBar({ role, notificationBadge = 0, displayName = '', email = '', initials = '' }: Props) {
  const isBrand = role === 'brand'
  const searchHref = isBrand ? '/creators' : '/jobs'
  const ctaHref = isBrand ? '/post-job' : '/jobs'
  const ctaLabel = isBrand ? 'Post a campaign' : 'Find campaigns'
  const CtaIcon = isBrand ? Plus : Compass

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  return (
    <header
      style={{
        height: 58,
        flex: '0 0 auto',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        borderBottom: '1px solid var(--line)',
        background: 'color-mix(in srgb, var(--paper) 80%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '0 20px 0 24px',
      }}
    >
      {/* left — quiet beta context (escrow lives at prime locations, not here) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <span
          className="hidden sm:inline"
          style={{
            fontSize: 13,
            color: 'var(--ink-faint-solid)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Free during beta · Singapore · No card needed
        </span>
      </div>

      {/* right — search / notifications / primary action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <IconButton href={searchHref} label="Search">
          <Search size={17} />
        </IconButton>

        <IconButton href="/notifications" label="Notifications">
          <Bell size={17} />
          {notificationBadge > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 7,
                right: 8,
                width: 6,
                height: 6,
                borderRadius: 99,
                background: 'var(--warn)',
                border: '1.5px solid var(--paper)',
              }}
            />
          )}
        </IconButton>

        {/* CTA — brands keep "Post a campaign" everywhere; creators' "Find
            campaigns" is redundant with the Browse tab on mobile, so hide it
            there to declutter next to the account avatar. */}
        <motion.div
          className={isBrand ? '' : 'hidden md:block'}
          whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <Link href={ctaHref} className="btn-primary" style={{ height: 38, paddingInline: 16 }}>
            <CtaIcon size={16} />
            <span className="hidden sm:inline">{ctaLabel}</span>
          </Link>
        </motion.div>

        {/* Mobile account menu — the sidebar (with sign out) is hidden ≤768px */}
        <div ref={menuRef} className="md:hidden" style={{ position: 'relative' }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Account"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 0, cursor: 'pointer',
              background: 'var(--ink)', color: '#fff', fontWeight: 600, fontSize: 12,
              display: 'grid', placeItems: 'center', fontFamily: 'var(--font-body)',
            }}
          >
            {initials || 'U'}
          </motion.button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                style={{
                  position: 'absolute', top: 42, right: 0, zIndex: 50, width: 220,
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', padding: 8,
                }}
              >
                <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName || 'Account'}</div>
                  {email && <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>}
                </div>
                <Link href={isBrand ? '/settings' : '/profile'} onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '9px 10px', fontSize: 13.5, color: 'var(--ink)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}>
                  {isBrand ? 'Brand profile' : 'My profile'}
                </Link>
                <form action="/api/auth/signout" method="POST">
                  <button type="submit"
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 10px', fontSize: 13.5,
                      color: 'var(--danger)', background: 'transparent', border: 0, cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8,
                      fontFamily: 'var(--font-body)',
                    }}>
                    <LogOut size={15} /> Sign out
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

function IconButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
      <Link
        href={href}
        aria-label={label}
        title={label}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-faint-solid)',
          transition: 'background .15s ease, color .15s ease',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget
          el.style.background = 'var(--paper-2)'
          el.style.color = 'var(--ink-soft)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.background = 'transparent'
          el.style.color = 'var(--ink-faint-solid)'
        }}
      >
        {children}
      </Link>
    </motion.div>
  )
}
