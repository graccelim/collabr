import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import { AppNav } from '@/components/AppNav'
import TrustBanners from '@/components/TrustBanners'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile) redirect('/signup')

  const role = profile.role as 'brand' | 'creator'

  // Trust & onboarding state for the banner (admins are exempt).
  let onboardingComplete = true
  if (role === 'creator') {
    const { data: creator } = await supabase.from('creator_profiles')
      .select('onboarding_completed_at').eq('user_id', user.id).single()
    onboardingComplete = Boolean(creator?.onboarding_completed_at)
  } else if (role === 'brand') {
    const { data: brand } = await supabase.from('brand_profiles')
      .select('onboarding_completed_at').eq('user_id', user.id).single()
    onboardingComplete = Boolean(brand?.onboarding_completed_at)
  }
  const emailVerified = Boolean(user.email_confirmed_at)
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
          maxWidth: 1080,
          margin: '0 auto',
          padding: '24px 28px 64px',
        }}>
          {(role === 'brand' || role === 'creator') && (
            <TrustBanners
              emailVerified={emailVerified}
              onboardingComplete={onboardingComplete}
              role={role}
            />
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
