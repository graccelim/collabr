'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck, Search, Bell, Plus, Compass } from 'lucide-react'

interface Props {
  role: 'brand' | 'creator'
  /** Unread notifications — drives the bell dot. */
  notificationBadge?: number
}

/**
 * Persistent app top bar (Collabr Redesign): a semantic escrow badge + the
 * beta context strip on the left, quick search / notifications / the primary
 * workspace action on the right. Sticks under the scroll container with a
 * blurred canvas backdrop. Framer drives the icon-button + CTA micro-presses.
 */
export default function TopBar({ role, notificationBadge = 0 }: Props) {
  const isBrand = role === 'brand'
  const searchHref = isBrand ? '/creators' : '/jobs'
  const ctaHref = isBrand ? '/post-job' : '/jobs'
  const ctaLabel = isBrand ? 'Post a campaign' : 'Find campaigns'
  const CtaIcon = isBrand ? Plus : Compass

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
      {/* left — escrow assurance + beta context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <span
          className="badge badge-money"
          style={{ flexShrink: 0, paddingTop: 4, paddingBottom: 4 }}
        >
          <ShieldCheck size={13} />
          Escrow protected
        </span>
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

        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
          <Link href={ctaHref} className="btn-primary" style={{ height: 38, paddingInline: 16 }}>
            <CtaIcon size={16} />
            <span className="hidden sm:inline">{ctaLabel}</span>
          </Link>
        </motion.div>
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
