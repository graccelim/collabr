import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import { getAuthUser, getUserRow } from '@/lib/auth'
import { AppNav } from '@/components/AppNav'
import TopBar from '@/components/TopBar'
import PageTransition from '@/components/PageTransition'
import TrustBanners from '@/components/TrustBanners'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Memoized (react cache): the page's own guard reuses these same results, so
  // there's only one getUser + one profile read for the whole request.
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const profile = await getUserRow()
  if (!profile) redirect('/signup')

  const role = profile.role as 'brand' | 'creator'
  const supabase = createClient()

  // Role-specific trust/plan state + the notification badge are independent of
  // each other - run them concurrently instead of one waterfall.
  const [roleState, { count: unreadCount }] = await Promise.all([
    role === 'creator'
      ? (async () => {
          const { data: creator } = await supabase.from('creator_profiles')
            .select('id, onboarding_completed_at').eq('user_id', user.id).single()
          // Invites awaiting this creator + any social profiles still missing a
          // follower count (drives the "add your followers" nudge).
          const [{ count }, { data: socs }] = creator
            ? await Promise.all([
                supabase.from('campaign_invites')
                  .select('*', { count: 'exact', head: true })
                  .eq('creator_id', creator.id).eq('status', 'pending'),
                supabase.from('social_accounts')
                  .select('follower_count').eq('creator_id', creator.id),
              ])
            : [{ count: 0 }, { data: [] as { follower_count: number | null }[] }]
          const needsFollowers = (socs || []).length > 0 && (socs || []).some(s => s.follower_count == null)
          return { onboardingComplete: Boolean(creator?.onboarding_completed_at), inviteBadge: count || 0, planLabel: '', profileHref: creator ? `/creators/${creator.id}` : '/profile', needsFollowers }
        })()
      : (async () => {
          // Admin client: subscription columns are not client-readable.
          const admin = createAdminClient()
          const { data: brand } = await admin.from('brand_profiles')
            .select(`id, onboarding_completed_at, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
          const plan = resolvePlan(brand)
          // Best-effort: brand socials (jsonb) missing a follower count. Tolerates
          // DBs where the `socials` column isn't applied yet.
          let needsFollowers = false
          const { data: bSoc } = await admin.from('brand_profiles').select('socials').eq('user_id', user.id).maybeSingle()
          const socs = Array.isArray((bSoc as { socials?: unknown } | null)?.socials) ? (bSoc as { socials: { follower_count?: number | null }[] }).socials : []
          needsFollowers = socs.length > 0 && socs.some(s => s.follower_count == null)
          return { onboardingComplete: Boolean(brand?.onboarding_completed_at), inviteBadge: 0, planLabel: plan.isPro ? plan.label : '', profileHref: brand ? `/brands/${brand.id}` : '/settings', needsFollowers }
        })(),
    supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false),
  ])

  const { onboardingComplete, planLabel, inviteBadge, profileHref, needsFollowers } = roleState
  const emailVerified = Boolean(user.email_confirmed_at)
  const displayName = profile.display_name || profile.email?.split('@')[0] || 'User'
  const initials = getInitials(displayName)
  const notificationBadge = unreadCount || 0

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--app-bg)',
    }}>
      <AppNav
        role={role}
        displayName={displayName}
        email={profile.email || ''}
        initials={initials}
        planLabel={planLabel}
        inviteBadge={inviteBadge}
        notificationBadge={notificationBadge}
        profileHref={profileHref}
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
        <TopBar role={role} notificationBadge={notificationBadge} displayName={displayName} email={profile.email || ''} initials={initials} profileHref={profileHref} />
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
              needsFollowers={needsFollowers}
              profileHref={role === 'brand' ? '/settings' : '/profile'}
            />
          )}
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  )
}
