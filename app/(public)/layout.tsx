import { getAuthUser, getUserRow } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import PublicHeader from '@/components/PublicHeader'

/**
 * Adaptive shell for public pages (creator/brand profiles, campaign detail).
 *
 * - Logged-in visitors keep their full app chrome (sidebar + top bar) via
 *   AppShell, so a public page feels like part of the product.
 * - Logged-out visitors get minimal public chrome (logo + Log in + Join free)
 *   and are NEVER redirected to /login — viewing is open; only actions gate.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  const profile = user ? await getUserRow() : null

  if (user && profile) {
    return <AppShell>{children}</AppShell>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)' }}>
      <PublicHeader />
      <main className="dash-pad" style={{ maxWidth: 1080, margin: '0 auto', width: '100%', padding: '24px 28px 64px' }}>
        {children}
      </main>
    </div>
  )
}
