import { redirect } from 'next/navigation'
import { getAuthUser, getUserRow } from '@/lib/auth'
import AppShell from '@/components/AppShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Gate the whole dashboard: a logged-out user (or one without a profile yet)
  // is bounced to login/signup. The chrome itself lives in AppShell, which the
  // public layout also reuses for its logged-in branch. Auth helpers are
  // react-cache memoized, so AppShell re-reading them costs nothing.
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const profile = await getUserRow()
  if (!profile) redirect('/signup')

  return <AppShell>{children}</AppShell>
}
