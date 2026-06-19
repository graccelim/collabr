import type { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRow } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import { NICHE_LABELS, SOCIAL_LABELS, socialHandleLabel, type CreatorNiche, type SocialPlatform } from '@/lib/onboarding'
import { AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles'
import SaveCreatorButton from '@/components/SaveCreatorButton'
import InviteCreatorForm from '@/components/InviteCreatorForm'
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
import Link from 'next/link'
import { MapPin, ExternalLink, Clock, Pencil, FileText, Link2 as LinkIcon, Users, CheckCircle2, Star, ShieldCheck } from 'lucide-react'

// SEO: "[Creator name] on Collabr". Resolves by slug or UUID, same as the page.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const admin = createAdminClient()
  const byCol = isUuid(params.slug) ? 'id' : 'slug'
  const { data } = await admin.from('creator_profiles')
    .select('users(display_name)').eq(byCol, params.slug).maybeSingle()
  const name = (data?.users as any)?.display_name || 'Creator'
  const title = `${name} on Collabr`
  return { title, description: `${name}'s creator profile on Collabr — work, niches and rates.`, openGraph: { title }, twitter: { title } }
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
    .select('id, slug, user_id, bio, niche, niches, niche_tags, location, portfolio_links, media_kit_url, average_rate_sgd, availability_status, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, created_at, users(display_name, avatar_url)')
    .eq(byCol, params.slug).single()
  if (!creator) return <p className="text-sm text-red-500">Creator not found.</p>
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
      .select('invites_concluded, response_rate_shrunk').eq('creator_id', creatorId).maybeSingle(),
    getUserRow(),
  ])

  // Owner viewing their own profile (Profile nav lands here) → show Edit, not
  // brand actions. "This is how brands see you."
  const isOwner = !!user && creator.user_id === user.id
  // Brand viewer: saved state + invitable campaigns (active, paid).
  const isBrandViewer = !!user && viewer?.role === 'brand' && !isOwner
  let isSaved = false
  let viewerIsPro = false
  let inviteCampaigns: { id: string; title: string }[] = []
  let pendingInviteCampaignIds: string[] = []
  if (isBrandViewer && user) {
    const { data: brand } = await admin.from('brand_profiles')
      .select(`id, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
    viewerIsPro = resolvePlan(brand).isPro
    if (brand) {
      const [{ data: saved }, { data: campaigns }, { data: pendingInvites }] = await Promise.all([
        supabase.from('saved_creators')
          .select('id').eq('brand_id', brand.id).eq('creator_id', creatorId).maybeSingle(),
        supabase.from('campaigns')
          .select('id, title').eq('brand_id', brand.id).eq('status', 'active')
          .in('comp_type', ['paid', 'both']).order('created_at', { ascending: false }),
        supabase.from('campaign_invites')
          .select('campaign_id').eq('brand_id', brand.id).eq('creator_id', creatorId)
          .eq('status', 'pending'),
      ])
      isSaved = Boolean(saved)
      inviteCampaigns = campaigns || []
      pendingInviteCampaignIds = (pendingInvites || [])
        .map(i => i.campaign_id).filter((id): id is string => Boolean(id))
    }
  }

  const name = (creator.users as any)?.display_name || 'Creator'
  const avatar = (creator.users as any)?.avatar_url
  const isBoosted = boostEnabled() && creator.boost_active_until && new Date(creator.boost_active_until) > new Date()
  const availability = creator.availability_status as AvailabilityStatus | null

  // Honest, categorical responsiveness - "Not enough response history yet" until
  // there's a real sample. Never a percentage.
  const response = responseStanding(
    (scoreRow as any)?.invites_concluded,
    (scoreRow as any)?.response_rate_shrunk != null ? Number((scoreRow as any).response_rate_shrunk) : null,
  )

  const socials = (socialAccounts as SocialAccount[]) || []
  const primarySocial = socials[0]
  const totalFollowers = socials.reduce((sum, s) => sum + (s.follower_count || 0), 0)
  const rate = creator.average_rate_sgd ?? creator.base_rate

  const completedCollabs = creator.collabs_completed || 0
  const isNewCreator = completedCollabs === 0
  const showRating = (creator.rating_count || 0) >= 1

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
                <Avatar src={avatar} name={name} size={76} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <h1 className="display-face" style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{name}</h1>
                    {isNewCreator && <span className="badge badge-neutral" style={{ fontSize: 11 }}>New Creator</span>}
                    {isBoosted && <span className="badge badge-accent" style={{ fontSize: 11 }} title="Sponsored placement">Boosted</span>}
                  </div>
                  {primarySocial && (
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 540, marginTop: 5 }}>
                      {socialHandleLabel(primarySocial.platform as SocialPlatform, primarySocial.handle)}
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

              {/* Visitor (anyone-c, not c-c) on phones: share sits top-right,
                  inline with the name. Desktop keeps it in the actions row.
                  Toggled via globals.css (.vis-hero-share) so it's robust on
                  mobile regardless of Tailwind responsive build state. */}
              {!isOwner && (
                <div className="vis-hero-share" style={{ flexShrink: 0 }}>
                  <ShareProfileButton path={`/creators/${slug}`} name={name} />
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
            <div className="bc-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              {isBrandViewer && viewerIsPro && (
                <>
                  <InviteCreatorForm
                    creatorId={creatorId}
                    creatorName={name}
                    campaigns={inviteCampaigns}
                    pendingCampaignIds={pendingInviteCampaignIds}
                  />
                  <SaveCreatorButton creatorId={creatorId} initialSaved={isSaved} />
                </>
              )}
              {/* Share moves to the hero top-right on phones; stays here on desktop. */}
              <span className="vis-row-share">
                <ShareProfileButton path={`/creators/${slug}`} name={name} />
              </span>
            </div>
            {isBrandViewer && !viewerIsPro && (
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10, maxWidth: 320 }}>
                Inviting and saving creators comes with collabr Pro.{' '}
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
                      <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="rail-link">
                        <span style={{ width: 26, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                          <Icon size={22} />
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{SOCIAL_LABELS[s.platform as SocialPlatform] || s.platform}</span>
                            {s.is_primary && (
                              <span className="badge badge-accent" style={{ fontSize: 9.5, padding: '1px 6px' }}>Primary</span>
                            )}
                          </span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-faint-solid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {socialHandleLabel(s.platform as SocialPlatform, s.handle)}
                            {s.follower_count != null && ` · ${s.follower_count.toLocaleString()} followers`}
                          </span>
                        </span>
                        <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                      </a>
                    )
                  })}
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-faint-solid)', marginTop: 10, lineHeight: 1.5 }}>
                  {isOwner
                    ? 'This is what brands see. Follower counts are self-reported.'
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
                          {info.handle && <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-faint-solid)' }}>@{info.handle}{info.followers ? ` · ${Number(info.followers).toLocaleString()} followers` : ''}</span>}
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
          [ShieldCheck, 'Escrow protected', 'Payment is locked in before work starts'],
          [Clock, '48h review window', 'Time to review and approve the content'],
          [CheckCircle2, 'Guaranteed payment', 'Deliver the work and you get paid, every time'],
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
  // brand leads with rates & terms, then socials, availability.
  const rail = (
    <div style={{ position: 'sticky', top: 24 }}>
      {isOwner
        ? <>{rateCard}{availabilitySection}{socialSection}</>
        : <>{ratesTerms}{socialSection}{availabilitySection}</>}
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
