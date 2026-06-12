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
      {/* ── Desktop Sidebar — quiet light chrome, indigo active state ── */}
      <aside
        className="sidebar-desktop scroll-y"
        style={{
          width: collapsed ? 64 : 224,
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--line)',
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
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}>
          {!collapsed && (
            <Link href="/" style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16.5,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
            }}>
              collabr<span style={{ color: 'var(--creator)' }}>.</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--ink-faint-solid)',
              width: 26, height: 26,
              borderRadius: 6,
              display: 'grid', placeItems: 'center',
              cursor: 'pointer', flexShrink: 0,
              transition: 'background .15s ease, color .15s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--paper-2)'; el.style.color = 'var(--ink-soft)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'transparent'; el.style.color = 'var(--ink-faint-solid)'
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
          {!collapsed && (
            <div style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: '.07em',
              textTransform: 'uppercase', color: 'var(--ink-faint-solid)',
              padding: '6px 8px 6px',
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
                  gap: 9,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 7,
                  padding: collapsed ? '8px 0' : '6px 8px',
                  background: on ? 'var(--accent-tint)' : 'transparent',
                  color: on ? 'var(--accent-deep)' : 'var(--ink-soft)',
                  fontWeight: on ? 600 : 500,
                  fontSize: 13,
                  transition: 'background .13s ease, color .13s ease',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (!on) (e.currentTarget as HTMLElement).style.background = 'var(--paper-2)'
                }}
                onMouseLeave={e => {
                  if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <NavIcon size={16} style={{ opacity: on ? 1 : .75 }} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Beta notice + user */}
        {!collapsed && (
          <div style={{ padding: 10, borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <div style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '8px 10px',
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-deep)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 2 }}>Beta · Free</div>
              <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.4, margin: 0 }}>
                No platform fees. 30 days notice before any change.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'var(--ink)', color: '#fff',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11,
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint-solid)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {email}
                </div>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" title="Sign out" style={{
                  border: 0, background: 'transparent',
                  color: 'var(--ink-faint-solid)',
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
