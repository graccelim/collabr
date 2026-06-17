'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import type { LucideProps } from 'lucide-react'
import {
  LayoutGrid, Briefcase, Link2, Users, Wallet,
  Compass, FileText, Settings, Bell, User,
  CreditCard, ChevronLeft, ChevronRight, LogOut,
  Mail,
} from 'lucide-react'

type Icon = React.ComponentType<Partial<LucideProps>>

interface NavItem {
  href: string
  label: string
  icon: Icon
  exact?: boolean
  /** Subtle premium marker - teaches which features are Pro without blocking. */
  pro?: boolean
}

// Profile + Notifications sit in a quick-access row at the TOP of the sidebar.
// Profile resolves to the user's own public profile via the /__profile__ sentinel.
const TOP_NAV: NavItem[] = [
  { href: '/__profile__',   label: 'Profile',       icon: User },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

const BRAND_NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Overview',          icon: LayoutGrid, exact: true },
  { href: '/campaigns',     label: 'Your campaigns',    icon: Briefcase },
  { href: '/collabs',       label: 'Collabs',           icon: Link2 },
  { href: '/creators',      label: 'Discover creators', icon: Users, pro: true },
  { href: '/invites',       label: 'Your invitations',  icon: Mail,  pro: true },
  { href: '/billing',       label: 'Billing',           icon: CreditCard },
]

// Decluttered: Settings folds into Profile (Profile = public view + edit + account),
// and Boost lives inside Earnings (boost → earn more) rather than its own item.
const CREATOR_NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Overview',           icon: LayoutGrid, exact: true },
  { href: '/jobs',          label: 'Discover campaigns', icon: Compass },
  { href: '/invites',       label: 'Invites',            icon: Mail },
  { href: '/collabs',       label: 'Collabs',            icon: Link2 },
  { href: '/applications',  label: 'Applications',       icon: FileText },
  { href: '/earnings',      label: 'Earnings',           icon: Wallet },
]

// Mobile bottom bar - Profile + Notifications live in the top bar, so these are
// the core sections only.
const BRAND_TABS: NavItem[] = [
  { href: '/dashboard', label: 'Overview',  icon: LayoutGrid, exact: true },
  { href: '/campaigns', label: 'Campaigns', icon: Briefcase },
  { href: '/collabs',   label: 'Collabs',   icon: Link2 },
  { href: '/creators',  label: 'Creators',  icon: Users },
  { href: '/billing',   label: 'Billing',   icon: CreditCard },
]

const CREATOR_TABS: NavItem[] = [
  { href: '/dashboard',    label: 'Overview',  icon: LayoutGrid, exact: true },
  { href: '/jobs',         label: 'Discover',  icon: Compass },
  { href: '/invites',      label: 'Invites',   icon: Mail },
  { href: '/collabs',      label: 'Collabs',   icon: Link2 },
  { href: '/earnings',     label: 'Earnings',  icon: Wallet },
]

interface AppNavProps {
  role: 'brand' | 'creator'
  displayName: string
  email: string
  initials: string
  /** Resolved plan label for brands, e.g. "Pro Beta" - empty hides the badge. */
  planLabel?: string
  /** Pending invites awaiting the creator's response. */
  inviteBadge?: number
  /** Unread notifications for the signed-in user. */
  notificationBadge?: number
  /** The signed-in user's own public profile (Profile nav target). */
  profileHref?: string
}

export function AppNav({ role, displayName, email, initials, planLabel, inviteBadge = 0, notificationBadge = 0, profileHref }: AppNavProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const isBrand = role === 'brand'
  const fallbackProfile = isBrand ? '/settings' : '/profile'
  const topNav = TOP_NAV.map(i =>
    i.href === '/__profile__' ? { ...i, href: profileHref || fallbackProfile } : i
  )
  const nav = isBrand ? BRAND_NAV : CREATOR_NAV
  const tabs = isBrand ? BRAND_TABS : CREATOR_TABS

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const renderItem = (item: NavItem) => {
    const on = isActive(item)
    const NavIcon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 11,
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 'var(--radius-sm)',
          padding: collapsed ? '9px 0' : '8px 10px',
          background: 'transparent',
          color: on ? '#fff' : 'rgba(255,255,255,.68)',
          fontWeight: on ? 600 : 480, fontSize: 13.5,
          transition: 'color .13s ease', textDecoration: 'none',
          whiteSpace: 'nowrap', position: 'relative',
        }}
        onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.07)' }}
        onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {on && (
          <motion.span layoutId="sidebar-active"
            style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.12)', zIndex: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
        )}
        <NavIcon size={16} style={{ opacity: on ? 1 : .82, position: 'relative', zIndex: 1 }} />
        {!collapsed && <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>}
        {(() => {
          const count = item.href === '/invites' ? inviteBadge
            : item.href === '/notifications' ? notificationBadge : 0
          if (!count) return null
          return collapsed ? (
            <span style={{ position: 'absolute', top: 6, right: 10, width: 7, height: 7, borderRadius: 99, background: 'var(--warn)', border: '1.5px solid var(--brand)' }} />
          ) : (
            <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: 'var(--warn)', color: '#fff', fontSize: 11, fontWeight: 600, position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count > 9 ? '9+' : count}</span>
          )
        })()}
        {!collapsed && item.pro && (
          <span style={{ marginLeft: 'auto', position: 'relative', zIndex: 1, fontSize: 8.5, fontWeight: 600, letterSpacing: '.06em', color: on ? '#fff' : 'rgba(255,255,255,.55)', border: `1px solid rgba(255,255,255,.22)`, padding: '0px 4px', borderRadius: 4, lineHeight: '12px' }}>PRO</span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* ── Desktop Sidebar - quiet light chrome, indigo active state ── */}
      <aside
        className="sidebar-desktop scroll-y"
        style={{
          width: collapsed ? 64 : 244,
          flexShrink: 0,
          background: 'var(--brand)',
          color: '#fff',
          borderRight: '1px solid rgba(255,255,255,.08)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width .2s ease',
          position: 'relative',
          zIndex: 10,
          overflow: 'hidden',
        }}
      >
        {/* Logo row */}
        <div style={{
          padding: collapsed ? '14px 0' : '14px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid rgba(255,255,255,.08)',
          flexShrink: 0,
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Link href="/dashboard" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 16.5,
                letterSpacing: '-0.03em',
                color: '#fff',
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8, background: '#fff',
                  color: 'var(--brand)', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0,
                }}>c</span>
                <span>collabr<span style={{ color: 'var(--accent-on-dark)' }}>.</span></span>
              </Link>
              {/* plan badge lives in the beta card below - keep the logo row calm */}
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              border: 0,
              background: 'transparent',
              color: 'rgba(255,255,255,.6)',
              width: 26, height: 26,
              borderRadius: 6,
              display: 'grid', placeItems: 'center',
              cursor: 'pointer', flexShrink: 0,
              transition: 'background .15s ease, color .15s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'rgba(255,255,255,.08)'; el.style.color = '#fff'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,.6)'
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav links */}
        <nav style={{
          flex: 1,
          padding: collapsed ? '8px 8px' : '8px 8px',
          display: 'flex', flexDirection: 'column', gap: 1,
          overflowY: 'auto',
        }}>
          {/* Quick access - Profile + Notifications at the top */}
          {topNav.map(renderItem)}
          {!collapsed && (
            <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '8px 8px' }} />
          )}
          {!collapsed && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5, fontWeight: 500, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,.45)',
              padding: '2px 8px 8px',
            }}>
              {isBrand ? 'Brand workspace' : 'Creator studio'}
            </div>
          )}
          {nav.map(renderItem)}
        </nav>

        {/* Beta notice + user */}
        {!collapsed && (
          <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
            <div style={{
              background: 'rgba(255,255,255,.06)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              marginBottom: 10,
            }}>
              <span className="badge" style={{ marginBottom: 6, background: 'rgba(255,255,255,.14)', color: '#fff' }}>
                {planLabel ? planLabel.toUpperCase() : 'BETA'}
              </span>
              <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', lineHeight: 1.45, margin: 0 }}>
                All features free during beta. We&rsquo;ll give 30 days&rsquo; notice before pricing.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'rgba(255,255,255,.12)', color: '#fff',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11,
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {email}
                </div>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" title="Sign out" aria-label="Sign out" style={{
                  border: 0, background: 'transparent', color: 'rgba(255,255,255,.6)',
                  cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center',
                  borderRadius: 6, transition: 'color .15s ease', flexShrink: 0,
                }}>
                  <LogOut size={15} />
                </button>
              </form>
            </div>
          </div>
        )}
      </aside>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="tab-bar">
        {tabs.map(item => {
          const on = isActive(item)
          const TabIcon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tab-bar-btn${on ? ' active' : ''}`}
            >
              <TabIcon size={21} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
