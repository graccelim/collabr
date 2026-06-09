import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import { AppNav } from '@/components/AppNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile) redirect('/signup')

  const role = profile.role as 'brand' | 'creator'
  const displayName = profile.display_name || profile.email?.split('@')[0] || 'User'
  const initials = getInitials(displayName)

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--paper)',
    }}>
      <AppNav
        role={role}
        displayName={displayName}
        email={profile.email || ''}
        initials={initials}
      />
      <main
        className="main-content"
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          maxHeight: '100vh',
        }}
      >
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '36px 28px 80px',
        }}>
          {children}
        </div>
      </main>
    </div>
  )
}
