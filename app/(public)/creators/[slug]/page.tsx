import type { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRow } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import { NICHE_LABELS, SOCIAL_LABELS, socialHandleLabel, type CreatorNiche, type SocialPlatform } from '@/lib/onboarding'
import { AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles'
import BrandCreatorActions from '@/components/BrandCreatorActions'
import CreatorTrust from '@/components/CreatorTrust'
import CollabrCertifiedBadge from '@/components/CollabrCertifiedBadge'
import ConnectedCreatorBadge from '@/components/ConnectedCreatorBadge'
import CreatorActiveBadge from '@/components/CreatorActiveBadge'
import BrandConnectedAnalytics from '@/components/BrandConnectedAnalytics'
import { socialIcon } from '@/components/SocialIcon'
import ProfileStats, { type ProfileStat } from '@/components/ProfileStats'
import ShareProfileButton from '@/components/ShareProfileButton'
import { chipColor } from '@/lib/niches'
import ProfileBackButton from '@/components/ProfileBackButton'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'
import { isUuid } from '@/lib/slug'
import { ensureCreatorSlug } from '@/lib/slug-server'
import type { SocialAccount } from '@/types'
import { responseStanding } from '@/lib/recommend'
import { boostEnabled } from '@/lib/stripe'
import ReviewList from '@/components/ReviewList'
import RatingSummaryCard from '@/components/RatingSummaryCard'
import { reportingRate, sharesResults } from '@/lib/results/report'
import Link from 'next/link'
import { MapPin, ExternalLink, Clock, Pencil, FileText, Link2 as LinkIcon, Users, CheckCircle2, Star, ShieldCheck, Send, Lock } from 'lucide-react'
import AuthGateButton from '@/components/AuthGateButton'
import CreatorJoinTeaserCard from '@/components/CreatorJoinTeaserCard'
import SocialProfileRow from '@/components/SocialProfileRow'

// SEO: "[Creator name] on Collabr". Resolves by slug or UUID, same as the page.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const admin = createAdminClient()
  const byCol = isUuid(params.slug) ? 'id' : 'slug'
  const { data } = await admin.from('creator_profiles')
    .select('display_name, user_id, users(display_name)').eq(byCol, params.slug).maybeSingle()
  const name = (data?.users as any)?.display_name || data?.display_name || 'Creator'
  const title = `${name} on Collabr`
  return {
    title,
    description: `${name}'s creator profile on Collabr, work, niches and rates.`,
    openGraph: { title },
    twitter: { title },
    // Unclaimed profiles stay reachable via /browse and a direct link (brand
    // discovery is unaffected) but skip search-engine indexing - a creator's
    // own vanity search shouldn't surface a page they don't recognize before
    // the claim DM does. Flips to indexed the moment they claim.
    robots: { index: !!data?.user_id, follow: true },
  }
}

export default async function CreatorProfilePage({ params, searchParams }: { params: { slug: string }; searchParams: { from?: string } }) {
  // Public page: viewing is open to logged-out visitors (no redirect). `user`
  // may be null - only owner/brand actions below depend on it.
  const user = await getAuthUser()
  const supabase = createClient()
  const admin = createAdminClient()

  // Admin client: public profile data, but the users join (display name /
  // avatar) is RLS-limited to own-row for session clients. Resolve by slug or
  // UUID so both /creators/girl-devours and /creators/<uuid> work.
  const byCol = isUuid(params.slug) ? 'id' : 'slug'
  const { data: creator } = await admin.from('creator_profiles')
    .select('id, slug, user_id, bio, niche, niches, niche_tags, location, portfolio_links, media_kit_url, average_rate_sgd, availability_status, platforms, base_rate, onboarding_completed_at, certified, connected, connected_platforms, insights_last_synced_at, boost_active_until, rating_avg, rating_count, collabs_completed, created_at, archived_at, users(display_name, avatar_url)')
    .eq(byCol, params.slug).single()
  if (!creator) return <p className="text-sm text-red-500">Creator not found.</p>
  // Archived = hidden from public view, same as discovery/search - but never
  // from the creator's own eyes (archiving is a visibility control, not a
  // suspension, and they can still use their own dashboard).
  if (creator.archived_at && creator.user_id !== user?.id) {
    return <p className="text-sm text-red-500">Creator not found.</p>
  }
  const creatorId = creator.id
  // Backfill a stable slug on first view if missing; the canonical URL uses it.
  const slug = creator.slug
    || (await ensureCreatorSlug(admin, creatorId, (creator.users as any)?.display_name || ''))
    || creatorId

  // Independent reads - connected socials, email verification, brand reviews,
  // and the memoized current-user row - issued concurrently.
  const [
    { data: socialAccounts },
    { data: emailVerified },
    { data: brandReviews },
    { data: scoreRow },
    viewer,
    { data: doneForRate },
    { data: reportedRows },
    { data: connectedRollup },
  ] = await Promise.all([
    supabase.from('social_accounts')
      .select('id, creator_id, platform, handle, url, follower_count, is_primary, created_at, updated_at')
      .eq('creator_id', creatorId)
      .order('is_primary', { ascending: false }).order('created_at'),
    supabase.rpc('user_email_verified', { p_user_id: creator.user_id }),
    supabase.from('reviews')
      .select('id, rating, note, created_at, collabs!inner(id, creator_id, campaigns(title), brand_profiles(company_name))')
      .eq('reviewer_type', 'brand')
      .eq('collabs.creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(50),
    // Internal score row - ONLY for the categorical response standing below.
    // Never rendered as a number; raw inputs stay server-side.
    admin.from('creator_scores')
      .select('invites_concluded, response_rate_shrunk, completed_count, completion_rate, response_time_median_hours, disputes_lost').eq('creator_id', creatorId).maybeSingle(),
    getUserRow(),
    admin.from('collabs').select('id, completed_at, brand_id').eq('creator_id', creatorId).eq('status', 'completed'),
    admin.from('collab_results').select('collab_id').eq('creator_id', creatorId),
    admin.from('creator_rollups').select('averages').eq('creator_id', creatorId).maybeSingle(),
  ])

  // Reporting rate: of collabs completed past the grace window, how many the
  // creator reported results for. Drives a "shares results" trust tile.
  const reportedSet = new Set((reportedRows ?? []).map((r: any) => r.collab_id))
  const reportRate = reportingRate((doneForRate ?? []).map((c: any) => ({
    completedAt: c.completed_at ? new Date(c.completed_at) : null,
    reportedAt: reportedSet.has(c.id) ? new Date() : null,
  })), new Date())
  const reportsResults = sharesResults(reportRate)

  // Owner viewing their own profile (Profile nav lands here) → show Edit, not
  // brand actions. "This is how brands see you."
  const isOwner = !!user && creator.user_id === user.id
  // Brand viewer: saved state + invitable campaigns (active, paid).
  const isBrandViewer = !!user && viewer?.role === 'brand' && !isOwner
  let isSaved = false
  let viewerIsPro = false
  let inviteCampaigns: { id: string; title: string; comp_type: string | null }[] = []
  let pendingInviteCampaignIds: string[] = []
  if (isBrandViewer && user) {
    const { data: brand } = await admin.from('brand_profiles')
      .select(`id, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
    viewerIsPro = resolvePlan(brand).isPlus // inviting is a Brand Plus feature
    if (brand) {
      const [{ data: saved }, { data: campaigns }, { data: pendingInvites }, { data: pendingRequests }] = await Promise.all([
        supabase.from('saved_creators')
          .select('id').eq('brand_id', brand.id).eq('creator_id', creatorId).maybeSingle(),
        supabase.from('campaigns')
          .select('id, title, comp_type').eq('brand_id', brand.id).eq('status', 'active')
          .in('comp_type', ['paid', 'both', 'barter']).order('created_at', { ascending: false }),
        supabase.from('campaign_invites')
          .select('campaign_id').eq('brand_id', brand.id).eq('creator_id', creatorId)
          .eq('status', 'pending'),
        // Unclaimed-creator asks queued via pending_collab_requests count too -
        // a brand shouldn't be able to request the same campaign twice just
        // because no campaign_invites row exists for it yet.
        admin.from('pending_collab_requests')
          .select('campaign_id').eq('brand_id', brand.id).eq('creator_id', creatorId)
          .is('materialized_at', null),
      ])
      isSaved = Boolean(saved)
      inviteCampaigns = campaigns || []
      pendingInviteCampaignIds = [...(pendingInvites || []), ...(pendingRequests || [])]
        .map(i => i.campaign_id).filter((id): id is string => Boolean(id))
    }
  }

  // Does this viewer get action buttons (Invite + Save) alongside Share? Only a
  // pro brand. When true, Share lives in that button row; when false, Share is
  // the lone action and moves up beside the name on phones.
  const hasProfileCtas = isBrandViewer && viewerIsPro

  const name = (creator.users as any)?.display_name || 'Creator'
  const avatar = (creator.users as any)?.avatar_url
  const isBoosted = boostEnabled() && creator.boost_active_until && new Date(creator.boost_active_until) > new Date()
  const availability = creator.availability_status as AvailabilityStatus | null
  // Logged-out visitor identity gate, consistent with /browse's grid cards -
  // blurring the grid but showing everything in plain text one click away on
  // this page would make that blur pointless. Never applies to the owner
  // (isOwner already implies a signed-in user) or any other signed-in viewer,
  // since anyone with an account is a real, accountable platform user.
  const blurIdentity = !user

  // Honest, categorical responsiveness - "Not enough response history yet" until
  // there's a real sample. Never a percentage.
  const response = responseStanding(
    (scoreRow as any)?.invites_concluded,
    (scoreRow as any)?.response_rate_shrunk != null ? Number((scoreRow as any).response_rate_shrunk) : null,
  )

  const socials = (socialAccounts as SocialAccount[]) || []
  const primarySocial = socials[0]
  // Pre-filled so a creator who clicks through from their own profile lands
  // straight on /join's confirm-identity step instead of having to re-type
  // the platform/handle it already knows.
  const joinHref = primarySocial
    ? `/join?platform=${primarySocial.platform}&handle=${encodeURIComponent(primarySocial.handle)}`
    : '/join'
  const totalFollowers = socials.reduce((sum, s) => sum + (s.follower_count || 0), 0)
  const rate = creator.average_rate_sgd ?? creator.base_rate

  const completedCollabs = creator.collabs_completed || 0
  const isNewCreator = completedCollabs === 0
  const showRating = (creator.rating_count || 0) >= 1

  // Repeat-brand count: brands who completed >1 collab with this creator.
  // Reuses the completed-collabs rows already fetched above (no extra query).
  let repeatBrands = 0
  if (completedCollabs > 0) {
    const byBrand = new Map<string, number>()
    for (const c of doneForRate || []) byBrand.set((c as any).brand_id as string, (byBrand.get((c as any).brand_id as string) || 0) + 1)
    repeatBrands = Array.from(byBrand.values()).filter(n => n >= 2).length
  }

  const primaryNiche = creator.niche
    ? NICHE_LABELS[creator.niche as CreatorNiche] || creator.niche
    : creator.niches?.[0]

  const portfolioLinks: string[] = creator.portfolio_links || []
  const memberSince = creator.created_at ? new Date(creator.created_at).getFullYear() : null

  const stats: ProfileStat[] = [
    { label: 'Followers', value: totalFollowers > 0 ? totalFollowers.toLocaleString() : '–', sub: 'self-reported', icon: Users, tone: 'neutral' },
    { label: 'Collabs', value: String(completedCollabs), sub: 'completed on collabr', icon: CheckCircle2, tone: 'accent' },
    { label: 'Rating', value: showRating ? String(creator.rating_avg) : '–', sub: showRating ? `${creator.rating_count} collaborator${creator.rating_count !== 1 ? 's' : ''}` : 'no reviews yet', icon: Star, tone: 'warn' },
  ]


  // Hero (identity + primary action), the stat band, the long-form content, and
  // the two rail sections are defined once, then arranged two ways: owners get a
  // full-width header with the rail below; visitors get the rail from the top.
  // Owner edit + share, used in the desktop hero (inline) and the mobile row.
  const ownerActions = (compact: boolean) => (
    <>
      <Link href="/profile" className="btn-primary"
        style={compact
          ? { flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 7 }
          : { display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <Pencil size={15} /> Edit profile
      </Link>
      <ShareProfileButton path={`/creators/${slug}`} name={name} />
    </>
  )

  const heroBlock = (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0 }}>
                <span style={blurIdentity ? { filter: 'blur(6px)', userSelect: 'none' as const } : undefined}>
                  <Avatar src={avatar} name={name} size={76} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <h1
                      className="display-face"
                      style={{
                        fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05,
                        ...(blurIdentity ? { filter: 'blur(5px)', userSelect: 'none' as const } : {}),
                      }}
                    >
                      {name}
                    </h1>
                    <CreatorActiveBadge claimed={!!creator.user_id} onboardingCompleted={!!creator.onboarding_completed_at} />
                    <CollabrCertifiedBadge certified={!!creator.certified} />
                    <ConnectedCreatorBadge connected={!!creator.connected} lastSyncedAt={creator.insights_last_synced_at as string | null} showSync={false} />
                    {isNewCreator && <span className="badge badge-neutral" style={{ fontSize: 11 }}>New Creator</span>}
                    {isBoosted && <span className="badge badge-accent" style={{ fontSize: 11 }} title="Sponsored placement">Boosted</span>}
                    {/* Phones, no other CTA: Share sits inline at the end of the
                        name row (pushed right). Hidden on desktop (in the row). */}
                    {!isOwner && !hasProfileCtas && (
                      <span className="vis-hero-share" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        <ShareProfileButton path={`/creators/${slug}`} name={name} />
                      </span>
                    )}
                  </div>
                  {primarySocial && (
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 540, marginTop: 5 }}>
                      {blurIdentity ? (
                        <span style={{ filter: 'blur(4px)', userSelect: 'none', display: 'inline-block' }}>
                          {socialHandleLabel(primarySocial.platform as SocialPlatform, primarySocial.handle)}
                        </span>
                      ) : (
                        socialHandleLabel(primarySocial.platform as SocialPlatform, primarySocial.handle)
                      )}
                    </div>
                  )}
                  {blurIdentity && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginTop: 6 }}>
                      <Lock size={11} /> Sign up to view this creator's profile
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px 12px', marginTop: 6, color: 'var(--ink-faint-solid)', fontSize: 13 }}>
                    {primaryNiche && <span>{primaryNiche} creator</span>}
                    {creator.location && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} />{creator.location}
                      </span>
                    )}
                    {availability && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: availability === 'available' ? 'var(--money-deep)' : 'var(--ink-faint-solid)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: availability === 'available' ? 'var(--money)' : availability === 'limited' ? 'var(--warn)' : 'var(--ink-faint-solid)' }} />
                        {availability === 'available' ? 'Available for collaborations' : AVAILABILITY_LABELS[availability]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Owner desktop: edit + share inline with the name. */}
              {isOwner && (
                <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {ownerActions(false)}
                </div>
              )}

            </div>
          </div>
  )

  // Below the stat strip. Owner: a full-width row on mobile only (desktop set
  // lives inline in the hero). Visitor: invite/save + share.
  const heroActions = isOwner ? (
          <div className="flex md:hidden" style={{ gap: 10, marginBottom: 30 }}>
            {ownerActions(true)}
          </div>
  ) : (
          <div className={isBrandViewer ? undefined : 'vis-actions-empty'} style={{ marginBottom: 30 }}>
            {hasProfileCtas ? (
              // Pro brand: Invite + Save + Share, with invite-open state lifted so
              // Save/Share hide/show instantly (no :has flicker).
              <BrandCreatorActions
                inviteProps={{ creatorId, creatorName: name, campaigns: inviteCampaigns, pendingCampaignIds: pendingInviteCampaignIds }}
                saveProps={{ creatorId, initialSaved: isSaved }}
                shareProps={{ path: `/creators/${slug}`, name }}
              />
            ) : (
              <div className="bc-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                {/* Logged out: reuse the exact same "sign in to continue" gate
                    already used for Apply on the public campaign page - not a
                    new auth flow. AuthModal's signup/login links carry
                    ?next=<this exact profile>, so after authenticating the
                    visitor lands right back here, where hasProfileCtas turns
                    true and the real Request Collaboration form takes over. */}
                {!user && (
                  <AuthGateButton>
                    <Send size={14} style={{ marginRight: 7 }} /> Request Collaboration
                  </AuthGateButton>
                )}
                {/* No CTAs: Share is desktop-only here (phones show it beside the
                    name via .vis-hero-share). */}
                <span className="vis-row-share">
                  <ShareProfileButton path={`/creators/${slug}`} name={name} />
                </span>
              </div>
            )}
            {isBrandViewer && !viewerIsPro && (
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10, maxWidth: 320 }}>
                Inviting and saving creators comes with collabr Plus.{' '}
                <Link href="/billing" style={{ fontWeight: 600, color: 'var(--accent-deep)' }}>Manage plan</Link>
              </p>
            )}
          </div>
  )

  const statsBlock = (
          <div style={{ marginBottom: isOwner ? 28 : 18 }}>
            <ProfileStats stats={stats} />
          </div>
  )

  const mainContent = (
        <>
          {/* Trust & reliability, real reputation, placeholder when no history */}
          <CreatorTrust
            completedCount={completedCollabs}
            completionRate={(scoreRow as any)?.completion_rate ?? null}
            responseTimeMedianHours={(scoreRow as any)?.response_time_median_hours ?? null}
            disputesCount={(scoreRow as any)?.disputes_lost ?? 0}
            ratingAvg={creator.rating_avg ?? 0}
            ratingCount={creator.rating_count ?? 0}
            repeatBrands={repeatBrands}
            reportsResults={reportsResults}
          />

          {/* Connected analytics, verified snapshot when connected; hidden for
              non-connected creators (owner sees a private connect nudge). */}
          <BrandConnectedAnalytics
            connected={!!creator.connected}
            lastSyncedAt={creator.insights_last_synced_at as string | null}
            platforms={(creator.connected_platforms as string[]) || []}
            rollup={connectedRollup}
            isOwner={isOwner}
          />

          {/* About */}
          {creator.bio && (
            <section style={{ marginBottom: 30 }}>
              <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>About</h2>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--ink)', whiteSpace: 'pre-wrap', margin: 0 }}>{creator.bio}</p>
            </section>
          )}

          {/* Niches - canonical niche_tags, falling back to the legacy list */}
          {(() => {
            const tags = (creator.niche_tags?.length ? creator.niche_tags : creator.niches) || []
            return tags.length > 0 ? (
              <section style={{ marginBottom: 30 }}>
                <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>Niches</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tags.map((n: string) => {
                    const c = chipColor(n)
                    return <span key={n} className="badge" style={{ background: c.bg, color: c.fg, fontWeight: 600 }}>{NICHE_LABELS[n as CreatorNiche] || n}</span>
                  })}
                </div>
              </section>
            ) : null
          })()}

          {/* Portfolio & links - clean link rows (no image previews) */}
          {(portfolioLinks.length > 0 || creator.media_kit_url) && (
            <section style={{ marginBottom: 30 }}>
              <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>Portfolio &amp; links</h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {creator.media_kit_url && (
                  <a href={creator.media_kit_url} target="_blank" rel="noopener noreferrer" className="rail-link">
                    <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
                      <FileText size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Media kit</span>
                    <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                  </a>
                )}
                {portfolioLinks.map((link, i) => {
                  const tints = [
                    { bg: 'var(--accent-tint)', fg: 'var(--accent-deep)' },
                    { bg: 'var(--money-tint)', fg: 'var(--money-deep)' },
                    { bg: 'var(--warn-tint)', fg: 'var(--warn-deep)' },
                    { bg: 'var(--creator-tint)', fg: 'var(--creator-deep)' },
                  ][i % 4]
                  return (
                    <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="rail-link">
                      <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: tints.bg, color: tints.fg, display: 'grid', placeItems: 'center' }}>
                        <LinkIcon size={15} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {link.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </span>
                      <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                    </a>
                  )
                })}
              </div>
            </section>
          )}

          {/* Brand reviews - revealed only; premium empty state for new creators */}
          {(() => {
            const items = (brandReviews || []).map(r => ({
              id: r.id, rating: r.rating, note: r.note,
              title: (r.collabs as any)?.campaigns?.title ?? null,
              author: (r.collabs as any)?.brand_profiles?.company_name ?? null,
              authorRole: 'brand' as const,
              when: r.created_at,
            }))
            const dist = [0, 0, 0, 0, 0]
            for (const r of items) if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++
            return (
              <>
                {items.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <RatingSummaryCard avg={creator.rating_avg} count={creator.rating_count} distribution={dist} totalReviews={items.length} />
                  </div>
                )}
                <ReviewList
                  heading="Brand reviews"
                  reviews={items}
                  emptyTitle={isOwner ? 'No reviews yet, let’s get you started' : 'No reviews yet'}
                  emptyBody={isOwner
                    ? 'Apply to campaigns and land your first collab, brands’ reviews will show up here and help you win more work.'
                    : 'Reviews from brands show up once a collab wraps, both sides submit, or 7 days pass.'}
                  ctaHref={isOwner ? '/jobs' : undefined}
                  ctaLabel={isOwner ? 'Browse campaigns' : undefined}
                />
              </>
            )
          })()}
        </>
  )

  // Social profiles - creator-provided, clickable so brands verify themselves.
  const socialSection = (
          <div className="rail-section">
            <div className="eyebrow" style={{ marginBottom: 6 }}>{isOwner ? 'Your social profiles' : 'Social profiles'}</div>
            {socials.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {socials.map(s => {
                    const Icon = socialIcon(s.platform)
                    return (
                      <SocialProfileRow
                        key={s.id}
                        href={s.url}
                        icon={<Icon size={22} />}
                        label={SOCIAL_LABELS[s.platform as SocialPlatform] || s.platform}
                        primary={s.is_primary}
                        handleLabel={socialHandleLabel(s.platform as SocialPlatform, s.handle)}
                        followerText={s.follower_count != null ? ` · ${s.follower_count.toLocaleString()} followers` : null}
                        gated={blurIdentity}
                      />
                    )
                  })}
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-faint-solid)', marginTop: 10, lineHeight: 1.5 }}>
                  {isOwner
                    ? 'This is what brands see. Follower counts are self-reported.'
                    : blurIdentity
                    ? 'Sign up to view and verify this creator\'s social profiles.'
                    : 'These links come straight from the creator, open them to check the account yourself. Follower counts are self-reported.'}
                </p>
              </>
            ) : creator.platforms && Object.keys(creator.platforms).length > 0 ? (
              // Legacy fallback for profiles created before normalized socials
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Object.entries(creator.platforms as Record<string, { handle: string; followers: number }>)
                  .map(([platform, info]) => {
                    const Icon = socialIcon(platform)
                    return (
                      <div key={platform} className="rail-link" style={{ cursor: 'default' }}>
                        <span style={{ width: 26, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                          <Icon size={22} />
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>{platform}</span>
                          {info.handle && (
                            <span style={{
                              display: 'block', fontSize: 12, color: 'var(--ink-faint-solid)',
                              ...(blurIdentity ? { filter: 'blur(4px)', userSelect: 'none' as const } : {}),
                            }}>
                              @{info.handle}{info.followers ? ` · ${Number(info.followers).toLocaleString()} followers` : ''}
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
                {isOwner ? 'You haven’t added any social profiles yet.' : 'This creator hasn’t added any social profiles yet.'}
              </div>
            )}
          </div>
  )

  const availabilitySection = (
          <div className="rail-section">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Availability</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {availability && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--ink)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: availability === 'available' ? 'var(--money)' : availability === 'limited' ? 'var(--warn)' : 'var(--ink-faint-solid)' }} />
                  {availability === 'available' ? 'Open to brand collaborations' : AVAILABILITY_LABELS[availability]}
                </div>
              )}
              {response.hasHistory && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--ink-soft)' }}>
                  <Clock size={14} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} /> {response.label}
                </div>
              )}
              {completedCollabs > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--ink-soft)' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--money)', flexShrink: 0 }} /> {completedCollabs} completed collaboration{completedCollabs !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            {(memberSince || emailVerified === true) && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--ink-faint-solid)' }}>
                {memberSince ? `Member since ${memberSince}` : ''}
                {memberSince && emailVerified === true ? ' · ' : ''}
                {emailVerified === true ? 'Email verified' : ''}
              </div>
            )}
          </div>
  )

  // Rates & terms (b-c) - the creator's rate plus the platform protections, in a
  // clean white card. Shown to a visiting brand.
  const ratesTerms = (
    <div className="rail-section">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Rates &amp; terms</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span className="mono-num" style={{ fontSize: 25, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {rate > 0 ? formatSGD(rate) : 'Negotiable'}
        </span>
        {rate > 0 && <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>/ post</span>}
        <span className="badge badge-neutral" style={{ fontSize: 10.5, marginLeft: 'auto' }}>Negotiable</span>
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {([
          [ShieldCheck, 'Payment protected', 'Payment is held safely before work starts'],
          [Clock, '48h review window', 'Time to review and approve the content'],
          [CheckCircle2, 'Protected payment', 'Approved work releases payment automatically'],
        ] as [typeof Clock, string, string][]).map(([Icon, t, sub]) => (
          <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon size={16} style={{ color: 'var(--money)', flexShrink: 0, marginTop: 1 }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-faint-solid)', lineHeight: 1.4 }}>{sub}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  // Owner's rate card (c-c) - moved out of the stat band into a white rail card.
  const rateCard = (
    <div className="rail-section">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Your rate</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span className="mono-num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {rate > 0 ? formatSGD(rate) : 'Negotiable'}
        </span>
        {rate > 0 && <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>/ post</span>}
      </div>
    </div>
  )

  // Owner leads with their rate, then availability, then socials; a visiting
  // brand leads with rates & terms, then socials, availability. An unclaimed
  // profile adds the claim-invite card last - secondary to everything a
  // brand actually came for, but still reachable by a self-Googling creator
  // scanning their own page. isOwner is always false here (no user_id yet).
  const rail = (
    <div style={{ position: 'sticky', top: 24 }}>
      {isOwner
        ? <>{rateCard}{availabilitySection}{socialSection}</>
        : <>{ratesTerms}{socialSection}{availabilitySection}{!creator.user_id && <CreatorJoinTeaserCard creatorId={creatorId} joinHref={joinHref} />}</>}
    </div>
  )

  return (
    <div className="screen-in" style={{ maxWidth: 1040, margin: '0 auto' }}>
      {!isOwner && (
        <ProfileBackButton from={searchParams.from} fallback="/creators" authed={!!user} />
      )}

      {isOwner ? (
        // Own profile: full-width header, stat strip, actions, then content + rail.
        <>
          {heroBlock}
          {statsBlock}
          {heroActions}
          <div className="pc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>{mainContent}</div>
            {rail}
          </div>
        </>
      ) : (
        // Visitor: two-column from the top (identity + content left, rail right).
        <div className="pc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            {heroBlock}
            {statsBlock}
            {heroActions}
            {mainContent}
          </div>
          {rail}
        </div>
      )}
    </div>
  )
}
