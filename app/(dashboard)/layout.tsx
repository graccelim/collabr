import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile) redirect('/signup')

  const isBrand = profile.role === 'brand'
  const isCreator = profile.role === 'creator'

  const brandLinks = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/post-job', label: 'Post a campaign' },
    { href: '/campaigns', label: 'My campaigns' },
    { href: '/collabs', label: 'Collabs' },
    { href: '/creators', label: 'Browse creators' },
    { href: '/billing', label: 'Billing' },
    { href: '/settings', label: 'Settings' },
  ]
  const creatorLinks = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/jobs', label: 'Browse jobs' },
    { href: '/applications', label: 'My applications' },
    { href: '/collabs', label: 'Collabs' },
    { href: '/profile', label: 'My profile' },
    { href: '/earnings', label: 'Earnings' },
    { href: '/boost', label: 'Boost' },
    { href: '/settings', label: 'Settings' },
  ]
  const links = isBrand ? brandLinks : isCreator ? creatorLinks : []

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-border flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <Link href="/" className="text-lg font-semibold text-gray-900">collabr.</Link>
          <div className="text-xs text-gray-400 mt-0.5">{isBrand ? 'Brand' : 'Creator'}</div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className="block px-3 py-2 text-sm text-gray-600 rounded hover:bg-surface hover:text-gray-900 transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 text-xs font-medium flex items-center justify-center">
              {getInitials(profile.display_name || profile.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 truncate">{profile.display_name}</div>
              <div className="text-xs text-gray-400 truncate">{profile.email}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="mt-2 text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </form>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  )
}
