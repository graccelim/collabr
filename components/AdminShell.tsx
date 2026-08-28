import Link from 'next/link'
import { Users, Scale, Flag, LogOut } from 'lucide-react'
import { getAuthUser, getUserRow } from '@/lib/auth'

const ADMIN_NAV = [
  { href: '/admin/creators', label: 'Creators', icon: Users },
  { href: '/admin/disputes', label: 'Disputes', icon: Scale },
  { href: '/admin/flagged-messages', label: 'Flagged messages', icon: Flag },
]

/**
 * Chrome for role='admin' accounts - deliberately NOT AppNav/TopBar. Those two
 * are built entirely around brand/creator concepts (Plus badges, invite
 * counts, post-job/discover CTAs, plan lookups against brand_profiles /
 * creator_profiles) that don't exist for an admin account - threading a third
 * role through them risked subtly breaking the brand/creator paths for a
 * one-page-deep admin tool. This is a separate, minimal shell instead: a
 * short link list to the actual admin pages, nothing else.
 */
export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  const profile = user ? await getUserRow() : null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <aside style={{
        width: 220, flexShrink: 0, background: 'var(--brand)', color: '#fff',
        borderRight: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <Link href="/admin" style={{
            display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)',
            fontWeight: 600, fontSize: 16.5, letterSpacing: '-0.03em', color: '#fff', textDecoration: 'none',
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: 8, background: '#fff', color: 'var(--brand)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0,
            }}>c</span>
            <span>collabr<span style={{ color: 'var(--accent-on-dark)' }}>.</span></span>
          </Link>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 500, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginTop: 8,
          }}>
            Admin
          </div>
        </div>

        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {ADMIN_NAV.map(item => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 11, borderRadius: 'var(--radius-sm)',
                padding: '8px 10px', color: 'rgba(255,255,255,.8)', fontWeight: 500, fontSize: 13.5,
                textDecoration: 'none',
              }}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.email || ''}
              </div>
            </div>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" title="Sign out" aria-label="Sign out" style={{
                border: 0, background: 'transparent', color: 'rgba(255,255,255,.6)', cursor: 'pointer',
                padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6, flexShrink: 0,
              }}>
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%', padding: '24px 28px 64px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
