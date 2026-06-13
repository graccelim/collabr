import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import { AppNav } from '@/components/AppNav'
import TopBar from '@/components/TopBar'
import PageTransition from '@/components/PageTransition'
import TrustBanners from '@/components/TrustBanners'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile) redirect('/signup')

  const role = profile.role as 'brand' | 'creator'

  // Trust & onboarding state for the banner (admins are exempt).
  let onboardingComplete = true
  let planLabel = ''
  let inviteBadge = 0
  if (role === 'creator') {
    const { data: creator } = await supabase.from('creator_profiles')
      .select('id, onboarding_completed_at').eq('user_id', user.id).single()
    onboardingComplete = Boolean(creator?.onboarding_completed_at)
    // Unread badge: invites awaiting this creator's response (read-only count;
    // RLS party policy scopes the rows to their own invites).
    if (creator) {
      const { count } = await supabase.from('campaign_invites')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', creator.id).eq('status', 'pending')
      inviteBadge = count || 0
    }
  } else if (role === 'brand') {
    // Admin client: subscription columns are not client-readable (RLS rows on
    // brand_profiles are public, so a column grant would leak billing state).
    const { data: brand } = await createAdminClient().from('brand_profiles')
      .select(`onboarding_completed_at, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
    onboardingComplete = Boolean(brand?.onboarding_completed_at)
    // Quiet plan badge — "Pro Beta" during beta, "Pro" when subscribed.
    const plan = resolvePlan(brand)
    planLabel = plan.isPro ? plan.label : ''
  }
  const emailVerified = Boolean(user.email_confirmed_at)
  const displayName = profile.display_name || profile.email?.split('@')[0] || 'User'
  const initials = getInitials(displayName)

  // Unread badge: notifications (read-only count; RLS scopes to own rows).
  const { count: unreadCount } = await supabase.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('read', false)
  const notificationBadge = unreadCount || 0

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
        planLabel={planLabel}
        inviteBadge={inviteBadge}
        notificationBadge={notificationBadge}
      />
      <main
        className="main-content"
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          maxHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TopBar role={role} notificationBadge={notificationBadge} />
        <div className="dash-pad" style={{
          maxWidth: 1080,
          margin: '0 auto',
          width: '100%',
          padding: '24px 28px 64px',
        }}>
          {(role === 'brand' || role === 'creator') && (
            <TrustBanners
              emailVerified={emailVerified}
              onboardingComplete={onboardingComplete}
              role={role}
            />
          )}
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  )
}
