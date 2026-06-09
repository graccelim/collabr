'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideProps } from 'lucide-react'
import {
  LayoutGrid, Briefcase, Link2, Users, Wallet,
  Compass, FileText, Settings, Bell, User,
  CreditCard, LogOut, ChevronLeft, ChevronRight,
  Zap,
} from 'lucide-react'

type Icon = React.ComponentType<Partial<LucideProps>>

interface NavItem {
  href: string
  label: string
  icon: Icon
  exact?: boolean
}

const BRAND_NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Overview',     icon: LayoutGrid, exact: true },
  { href: '/campaigns',     label: 'Campaigns',    icon: Briefcase },
  { href: '/collabs',       label: 'Collabs',      icon: Link2 },
  { href: '/creators',      label: 'Creators',     icon: Users },
  { href: '/notifications', label: 'Notifications',icon: Bell },
  { href: '/billing',       label: 'Billing',      icon: CreditCard },
  { href: '/settings',      label: 'Settings',     icon: Settings },
]

const CREATOR_NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Overview',     icon: LayoutGrid, exact: true },
  { href: '/jobs',          label: 'Browse',       icon: Compass },
  { href: '/applications',  label: 'Applications', icon: FileText },
  { href: '/collabs',       label: 'Collabs',      icon: Link2 },
  { href: '/earnings',      label: 'Earnings',     icon: Wallet },
  { href: '/profile',       label: 'Profile',      icon: User },
  { href: '/boost',         label: 'Boost',        icon: Zap },
  { href: '/notifications', label: 'Notifications',icon: Bell },
  { href: '/settings',      label: 'Settings',     icon: Settings },
]

const BRAND_TABS: NavItem[] = [
  { href: '/dashboard', label: 'Overview',   icon: LayoutGrid, exact: true },
  { href: '/campaigns', label: 'Campaigns',  icon: Briefcase },
  { href: '/collabs',   label: 'Collabs',    icon: Link2 },
  { href: '/creators',  label: 'Creators',   icon: Users },
  { href: '/settings',  label: 'More',       icon: Settings },
]

const CREATOR_TABS: NavItem[] = [
  { href: '/dashboard',    label: 'Home',         icon: LayoutGrid, exact: true },
  { href: '/jobs',         label: 'Browse',        icon: Compass },
  { href: '/applications', label: 'Applications', icon: FileText },
  { href: '/collabs',      label: 'Collabs',      icon: Link2 },
  { href: '/earnings',     label: 'Earnings',     icon: Wallet },
]

interface AppNavProps {
  role: 'brand' | 'creator'
  displayName: string
  email: string
  initials: string
}

export function AppNav({ role, displayName, email, initials }: AppNavProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const isBrand = role === 'brand'
  const nav  = isBrand ? BRAND_NAV  : CREATOR_NAV
  const tabs = isBrand ? BRAND_TABS : CREATOR_TABS

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside
        className="sidebar-desktop scroll-y"
        style={{
          width: collapsed ? 68 : 220,
          flexShrink: 0,
          background: 'var(--brand)',
          borderRight: '1px solid rgba(255,255,255,.07)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width .22s ease',
          position: 'relative',
          zIndex: 10,
          overflow: 'hidden',
        }}
      >
        {/* Logo row */}
        <div style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          flexShrink: 0,
        }}>
          {!collapsed && (
            <Link href="/" style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 19,
              letterSpacing: '-0.04em',
              color: '#fff',
            }}>
              collabr<span style={{ color: 'var(--creator)' }}>.</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              border: 0,
              background: 'rgba(255,255,255,.07)',
              color: 'rgba(255,255,255,.55)',
              width: 30, height: 30,
              borderRadius: 8,
              display: 'grid', placeItems: 'center',
              cursor: 'pointer', flexShrink: 0,
              transition: 'background .15s ease',
            }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav links */}
        <nav style={{
          flex: 1,
          padding: collapsed ? '10px 8px' : '10px 10px',
          display: 'flex', flexDirection: 'column', gap: 2,
          overflowY: 'auto',
        }}>
          {!collapsed && (
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.12em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,.3)',
              padding: '6px 10px 8px',
            }}>
              {isBrand ? 'Brand workspace' : 'Creator workspace'}
            </div>
          )}
          {nav.map(item => {
            const on = isActive(item)
            const NavIcon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 10,
                  padding: collapsed ? '10px 0' : '9px 10px',
                  background: on ? 'var(--accent-tint)' : 'transparent',
                  color: on ? 'var(--accent-deep)' : 'rgba(255,255,255,.58)',
                  fontWeight: on ? 700 : 500,
                  fontSize: 14,
                  transition: 'all .14s ease',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (!on) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.07)'
                }}
                onMouseLeave={e => {
                  if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <NavIcon size={17} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Beta notice + user */}
        {!collapsed && (
          <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
            <div style={{
              background: 'rgba(232,165,152,.1)',
              border: '1px solid rgba(232,165,152,.18)',
              borderRadius: 12,
              padding: 10,
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--creator)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 3 }}>Beta · Free</div>
              <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)', lineHeight: 1.4, margin: 0 }}>
                No platform fees. 30 days notice before any change.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--accent)', color: 'var(--accent-ink)',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.38)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {email}
                </div>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" title="Sign out" style={{
                  border: 0, background: 'transparent',
                  color: 'rgba(255,255,255,.35)',
                  cursor: 'pointer', padding: 4,
                  display: 'grid', placeItems: 'center',
                  borderRadius: 6, transition: 'color .15s ease',
                }}>
                  <LogOut size={14} />
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
