'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Plus, Search, LogOut } from 'lucide-react'

interface Props {
  role: 'brand' | 'creator'
  /** Unread notifications - drives the bell dot. */
  notificationBadge?: number
  /** For the mobile account menu (sidebar is hidden on mobile). */
  displayName?: string
  email?: string
  initials?: string
  /** Profile photo for the account avatar; falls back to initials when absent. */
  avatarUrl?: string | null
  /** The user's own public profile (Profile link target). */
  profileHref?: string
}

/**
 * Persistent app top bar (Collabr Redesign): a semantic escrow badge + the
 * beta context strip on the left, quick search / notifications / the primary
 * workspace action on the right. Sticks under the scroll container with a
 * blurred canvas backdrop. Framer drives the icon-button + CTA micro-presses.
 */
export default function TopBar({ role, notificationBadge = 0, displayName = '', email = '', initials = '', avatarUrl = null, profileHref }: Props) {
  // Account avatar visual - profile photo when set, initials otherwise.
  const avatarInner = avatarUrl
    ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    : (initials || 'U')
  const isBrand = role === 'brand'
  // Only the destinations the mobile BOTTOM bar doesn't already show, so the
  // account menu doesn't repeat the tabs (bottom bar = Overview / Campaigns /
  // Collabs / Creators / Billing for brands; Overview / Discover / Invites /
  // Collabs / Earnings for creators).
  const menuSections = isBrand
    ? [
        { href: '/invites', label: 'Your invitations' },
        { href: '/notifications', label: 'Notifications' },
      ]
    : [
        { href: '/applications', label: 'Applications' },
        { href: '/notifications', label: 'Notifications' },
      ]
  const ctaHref = isBrand ? '/post-job' : '/jobs'
  const ctaLabel = isBrand ? 'Post a campaign' : 'Discover campaigns'
  const CtaIcon = isBrand ? Plus : Search

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
      className="app-topbar"
      style={{
        height: 58,
        flex: '0 0 auto',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        borderBottom: '1px solid var(--line)',
        background: 'var(--app-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '0 20px 0 24px',
      }}
    >
      {/* left - primary action + notifications */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {/* CTA - brands keep "Post a campaign" everywhere; creators' "Discover
            campaigns" is redundant with the Browse tab on mobile, so hide it there. */}
        <motion.div
          whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <Link href={ctaHref} className="btn-secondary" style={{ height: 38, paddingInline: 16, background: 'var(--surface)' }}>
            <CtaIcon size={16} />
            <span className="hidden sm:inline">{ctaLabel}</span>
          </Link>
        </motion.div>
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
                border: '1.5px solid var(--app-bg)',
              }}
            />
          )}
        </IconButton>
      </div>

      {/* right - profile + sign-out (desktop) / account menu (mobile) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Desktop account controls - the sidebar no longer carries profile /
            notifications / sign-out, so they live here on ≥769px. */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8 }}>
          <Link
            href={profileHref || (isBrand ? '/settings' : '/profile')}
            aria-label="Your profile"
            title="Your profile"
            style={{
              width: 34, height: 34, borderRadius: '50%', overflow: 'hidden',
              background: 'var(--ink)', color: '#fff',
              fontWeight: 600, fontSize: 12,
              display: 'grid', placeItems: 'center',
              textDecoration: 'none', flexShrink: 0,
              fontFamily: 'var(--font-body)',
            }}
          >
            {avatarInner}
          </Link>
          <form action="/api/auth/signout" method="POST">
            <motion.button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              whileTap={{ scale: 0.92 }}
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                border: 0, background: 'transparent', cursor: 'pointer',
                color: 'var(--ink-faint-solid)',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-body)',
              }}
            >
              <LogOut size={17} />
            </motion.button>
          </form>
        </div>

        {/* Mobile account menu - the sidebar (with sign out) is hidden ≤768px */}
        <div ref={menuRef} className="md:hidden" style={{ position: 'relative' }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Account"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 0, cursor: 'pointer', overflow: 'hidden',
              background: 'var(--ink)', color: '#fff', fontWeight: 600, fontSize: 12,
              display: 'grid', placeItems: 'center', fontFamily: 'var(--font-body)',
            }}
          >
            {avatarInner}
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
                <Link href={profileHref || (isBrand ? '/settings' : '/profile')} onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '9px 10px', fontSize: 13.5, fontWeight: 600, color: 'var(--accent-deep)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}>
                  My profile
                </Link>
                <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
                {menuSections.map(s => (
                  <Link key={s.href} href={s.href} onClick={() => setMenuOpen(false)}
                    style={{ display: 'block', padding: '8px 10px', fontSize: 13.5, color: 'var(--ink)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}>
                    {s.label}
                  </Link>
                ))}
                <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
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
