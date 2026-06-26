import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getInitials } from '@/lib/utils'
import { getAuthUser, getUserRow } from '@/lib/auth'
import { AppNav } from '@/components/AppNav'
import TopBar from '@/components/TopBar'
import PageTransition from '@/components/PageTransition'
import TrustBanners from '@/components/TrustBanners'
import LiveRefresh from '@/components/LiveRefresh'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'

/**
 * The authenticated app chrome: sidebar + top bar + padded content. Shared by
 * the dashboard layout and the public layout's logged-in branch (so a signed-in
 * user keeps their normal navigation even on public profile/campaign pages).
 * Auth helpers are react-cache memoized, so re-reading here is free.
 */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  const profile = user ? await getUserRow() : null
  if (!user || !profile) {
    // Defensive: caller should only render AppShell for a logged-in user with a
    // profile. If not, show the content unchromed rather than crash.
    return (
      <div className="dash-pad" style={{ maxWidth: 1080, margin: '0 auto', width: '100%', padding: '24px 28px 64px' }}>
        {children}
      </div>
    )
  }

  const role = profile.role as 'brand' | 'creator'
  const supabase = createClient()

  const [roleState, { count: unreadCount }] = await Promise.all([
    role === 'creator'
      ? (async () => {
          // Admin read (mirrors the brand branch) so the owner's own profile row
          // is always found — otherwise RLS can return null and the Profile nav
          // falls back to /profile (edit) instead of the public /creators/[id].
          const admin = createAdminClient()
          const { data: creator } = await admin.from('creator_profiles')
            .select('id, onboarding_completed_at, invites_seen_at').eq('user_id', user.id).single()
          // Badge only counts invites that arrived since the tab was last opened.
          let inviteQuery = creator
            ? supabase.from('campaign_invites')
                .select('*', { count: 'exact', head: true })
                .eq('creator_id', creator.id).eq('status', 'pending')
            : null
          if (inviteQuery && creator?.invites_seen_at) inviteQuery = inviteQuery.gt('created_at', creator.invites_seen_at)
          const [{ count }, { data: socs }] = creator
            ? await Promise.all([
                inviteQuery!,
                supabase.from('social_accounts')
                  .select('follower_count').eq('creator_id', creator.id),
              ])
            : [{ count: 0 }, { data: [] as { follower_count: number | null }[] }]
          const needsFollowers = (socs || []).length > 0 && (socs || []).some(s => s.follower_count == null)
          return { onboardingComplete: Boolean(creator?.onboarding_completed_at), inviteBadge: count || 0, planLabel: '', profileHref: creator ? `/creators/${creator.id}` : '/profile', needsFollowers, avatarUrl: (profile.avatar_url as string | null) ?? null }
        })()
      : (async () => {
          const admin = createAdminClient()
          const { data: brand } = await admin.from('brand_profiles')
            .select(`id, onboarding_completed_at, logo_url, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
          const plan = resolvePlan(brand)
          return { onboardingComplete: Boolean(brand?.onboarding_completed_at), inviteBadge: 0, planLabel: plan.isPro ? plan.label : '', profileHref: brand ? `/brands/${brand.id}` : '/settings', needsFollowers: false, avatarUrl: (brand?.logo_url as string | null) ?? null }
        })(),
    supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false),
  ])

  const { onboardingComplete, planLabel, inviteBadge, profileHref, needsFollowers, avatarUrl } = roleState
  const emailVerified = Boolean(user.email_confirmed_at)
  const displayName = profile.display_name || profile.email?.split('@')[0] || 'User'
  const initials = getInitials(displayName)
  const notificationBadge = unreadCount || 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <LiveRefresh />
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
        style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <TopBar role={role} notificationBadge={notificationBadge} displayName={displayName} email={profile.email || ''} initials={initials} avatarUrl={avatarUrl} profileHref={profileHref} />
        <div className="dash-pad" style={{ maxWidth: 1080, margin: '0 auto', width: '100%', padding: '24px 28px 64px' }}>
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
