import type { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import ReviewList, { type ReviewItem } from '@/components/ReviewList'
import RatingSummaryCard from '@/components/RatingSummaryCard'
import ProfileBackButton from '@/components/ProfileBackButton'
import AuthGateLink from '@/components/AuthGateLink'
import { chipColor } from '@/lib/niches'
import { INDUSTRY_LABELS, SOCIAL_LABELS, socialHandleLabel, type BrandIndustry, type SocialPlatform } from '@/lib/onboarding'
import { isUuid } from '@/lib/slug'
import { ensureBrandSlug } from '@/lib/slug-server'
import { socialIcon } from '@/components/SocialIcon'
import ProfileStats, { type ProfileStat } from '@/components/ProfileStats'
import ShareProfileButton from '@/components/ShareProfileButton'
import Link from 'next/link'
import { Globe, Briefcase, Pencil, MapPin, ExternalLink, Star, CheckCircle2 } from 'lucide-react'

// SEO: "[Brand name] on Collabr". Resolves by slug or UUID, same as the page.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const admin = createAdminClient()
  const byCol = isUuid(params.slug) ? 'id' : 'slug'
  const { data } = await admin.from('brand_profiles')
    .select('company_name').eq(byCol, params.slug).maybeSingle()
  const name = data?.company_name || 'Brand'
  const title = `${name} on Collabr`
  return { title, description: `${name}'s brand profile on Collabr — campaigns, reputation and reviews.`, openGraph: { title }, twitter: { title } }
}

export default async function BrandProfilePage({ params, searchParams }: { params: { slug: string }; searchParams: { from?: string } }) {
  // Public page: open to logged-out visitors (no redirect). `user` may be null;
  // only the owner-edit affordance depends on it.
  const user = await getAuthUser()
  const supabase = createClient()
  const admin = createAdminClient()

  // Brand identity + public reputation (public data → admin read is fine).
  // Resolve by slug or UUID so /brands/wild-coco and /brands/<uuid> both work.
  const byCol = isUuid(params.slug) ? 'id' : 'slug'
  const BRAND_COLS = 'id, slug, user_id, company_name, company_description, industry, website, logo_url, completed_campaigns, rating_avg, rating_count, created_at'
  // `location` is newer (migration 020). Tolerate DBs where it isn't applied yet
  // so brand profiles never 404 during the migration window.
  let brand: any = null
  {
    const r = await admin.from('brand_profiles').select(`${BRAND_COLS}, location, social_url, socials`).eq(byCol, params.slug).single()
    brand = r.data
  }
  if (!brand) {
    const r = await admin.from('brand_profiles').select(`${BRAND_COLS}, location, social_url`).eq(byCol, params.slug).single()
    brand = r.data
  }
  if (!brand) {
    const r = await admin.from('brand_profiles').select(BRAND_COLS).eq(byCol, params.slug).single()
    brand = r.data
  }
  if (!brand) return <p className="text-sm" style={{ color: 'var(--danger)' }}>Brand not found.</p>
  const isOwner = !!user && brand.user_id === user.id
  const brandId = brand.id as string
  const slug = (brand.slug as string | null)
    || (await ensureBrandSlug(admin, brandId, brand.company_name || '')) || brandId

  // REVEALED reviews + active campaigns. Reviews go through the SESSION client so
  // the double-blind reveal RLS is enforced (admin would bypass it).
  const [{ data: reviewRows }, { data: campaigns }] = await Promise.all([
    supabase.from('reviews')
      .select('id, rating, note, created_at, collabs!inner(brand_id, campaigns(title), creator_profiles(users(display_name)))')
      .eq('reviewer_type', 'creator')
      .eq('collabs.brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('campaigns')
      .select('id, slug, title, comp_type, budget_min, budget_max, niche_tags')
      .eq('brand_id', brandId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(6),
  ])

  const name = brand.company_name || 'Brand'
  const memberSince = brand.created_at ? new Date(brand.created_at).getFullYear() : null
  const reviews: ReviewItem[] = (reviewRows || []).map(r => ({
    id: r.id, rating: r.rating, note: r.note,
    title: (r.collabs as any)?.campaigns?.title ?? null,
    author: (r.collabs as any)?.creator_profiles?.users?.display_name ?? null,
    authorRole: 'creator' as const,
    when: r.created_at,
  }))
  const dist = [0, 0, 0, 0, 0]
  for (const r of reviews) if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++

  const brandSocials: any[] = (Array.isArray(brand.socials) ? brand.socials : [])
    .filter((s: any) => s && s.platform && s.url)
    .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))

  const showRating = (brand.rating_count || 0) >= 1

  // What a creator gets working with this brand - the escrow promise, framed for
  // the creator reading it: it's funded upfront, so approved work always pays.
  // (Only shown to visitors, never on the brand's own-profile view.)
  const brandTerms: [string, string][] = [
    ['Funded before you start', 'The brand locks payment in escrow upfront'],
    ['Approved work always pays', 'Post the approved content and it’s yours'],
    ['Released automatically', 'No chasing invoices, escrow pays out on approval'],
  ]

  const stats: ProfileStat[] = [
    { label: 'Completed', value: String(brand.completed_campaigns || 0), sub: 'campaigns on collabr', icon: Briefcase, tone: 'accent' },
    { label: 'Rating', value: showRating ? String(brand.rating_avg) : '–', sub: showRating ? `${brand.rating_count} creator${brand.rating_count !== 1 ? 's' : ''}` : 'no reviews yet', icon: Star, tone: 'warn' },
  ]

  // Defined once, arranged two ways: owners get a full-width header with the rail
  // below; visitors get the rail from the top.
  const heroBlock = (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0 }}>
                <Avatar src={brand.logo_url} name={name} size={76} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <h1 className="display-face" style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{name}</h1>
                    {brand.industry && (() => {
                      const c = chipColor(brand.industry)
                      return <span className="badge" style={{ fontSize: 11, background: c.bg, color: c.fg, fontWeight: 600 }}>{INDUSTRY_LABELS[brand.industry as BrandIndustry] || brand.industry}</span>
                    })()}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px 12px', marginTop: 6, fontSize: 13, color: 'var(--ink-faint-solid)' }}>
                    {brand.location && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} />{brand.location}
                      </span>
                    )}
                    {memberSince && <span>Member since {memberSince}</span>}
                  </div>
                </div>
              </div>

              {/* Visitor (c-b): share sits top-right, inline with the name. */}
              {!isOwner && (
                <div style={{ flexShrink: 0 }}>
                  <ShareProfileButton path={`/brands/${slug}`} name={name} />
                </div>
              )}

              {/* Owner desktop (b-b): edit + share inline with the name. */}
              {isOwner && (
                <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <Link href="/settings" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <Pencil size={15} /> Edit profile
                  </Link>
                  <ShareProfileButton path={`/brands/${slug}`} name={name} />
                </div>
              )}
            </div>
          </div>
  )

  // Owner (b-b): full-width edit + share row below the stat strip, mobile only.
  const heroActions = isOwner ? (
          <div className="flex md:hidden" style={{ gap: 10, marginBottom: 30 }}>
            <Link href="/settings" className="btn-primary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Pencil size={15} /> Edit profile
            </Link>
            <ShareProfileButton path={`/brands/${slug}`} name={name} />
          </div>
  ) : null

  const statsBlock = (
          <div style={{ marginBottom: 28 }}>
            <ProfileStats stats={stats} />
          </div>
  )

  const mainContent = (
        <>
          {brand.company_description && (
            <section style={{ marginBottom: 30 }}>
              <h2 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>About</h2>
              <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>
                {brand.company_description}
              </p>
            </section>
          )}

          {brand.industry && (
            <section style={{ marginBottom: 30 }}>
              <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>Industry</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(() => {
                  const c = chipColor(brand.industry)
                  return <span className="badge" style={{ background: c.bg, color: c.fg, fontWeight: 600 }}>{INDUSTRY_LABELS[brand.industry as BrandIndustry] || brand.industry}</span>
                })()}
              </div>
            </section>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <RatingSummaryCard avg={brand.rating_avg} count={brand.rating_count} distribution={dist} totalReviews={reviews.length} />
            </div>
          )}
          <ReviewList
            reviews={reviews}
            heading="What creators say"
            emptyTitle={isOwner ? 'No reviews yet, let’s change that' : 'No reviews yet'}
            emptyBody={isOwner
              ? 'Run your first collab and creators’ reviews will show up here, building the trust that wins you better creators.'
              : 'Reviews from creators show up once a collab wraps, both sides submit, or 7 days pass.'}
            ctaHref={isOwner ? '/post-job' : undefined}
            ctaLabel={isOwner ? 'Post a campaign' : undefined}
          />
        </>
  )

  // RAIL - flat sections (no card boxes). The escrow pitch is for creators
  // reading the profile, so it's hidden on the brand's own-profile view.
  const rail = (
        <div style={{ position: 'sticky', top: 24 }}>
          {/* Open campaigns - the most actionable thing a creator can do here.
              "See all" → brand's own manager (owner) or brand-scoped discover. */}
          {campaigns && campaigns.length > 0 && (
            <div className="rail-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div className="eyebrow">{isOwner ? 'Your campaigns' : 'Open campaigns'}</div>
                {isOwner ? (
                  <Link href="/campaigns"
                    style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent-deep)', flexShrink: 0 }}>
                    See all
                  </Link>
                ) : (
                  // Brand-scoped discover is gated — guests get the auth modal.
                  <AuthGateLink href={`/jobs?brand=${brandId}`} authed={!!user}
                    style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent-deep)', flexShrink: 0 }}>
                    See all
                  </AuthGateLink>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {campaigns.slice(0, 4).map(c => {
                  const budget = c.budget_min && c.budget_max
                    ? `${formatSGD(c.budget_min)}–${formatSGD(c.budget_max)}`
                    : c.comp_type === 'barter' ? 'Barter' : 'Negotiable'
                  return (
                    <Link key={c.id} href={`/jobs/${(c as { slug?: string }).slug || c.id}`} className="rail-link">
                      <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
                        <Briefcase size={15} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--money-deep)' }}>{budget}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {!isOwner && (
            <div className="rail-section">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Working with {name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {brandTerms.map(([t, sub]) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--money)', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-faint-solid)', lineHeight: 1.4 }}>{sub}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(brand.website || brandSocials.length > 0) && (
            <div className="rail-section">
              <div className="eyebrow" style={{ marginBottom: 6 }}>{isOwner ? 'Your social profiles' : `Find ${name} online`}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {brand.website && (
                  <a href={brand.website} target="_blank" rel="noopener noreferrer nofollow" className="rail-link">
                    <span style={{ width: 26, flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-soft)' }}>
                      <Globe size={20} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Website</span>
                    <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                  </a>
                )}
                {brandSocials.map((s: any) => {
                  const Icon = socialIcon(s.platform)
                  return (
                    <a key={s.platform + s.handle} href={s.url} target="_blank" rel="noopener noreferrer" className="rail-link">
                      <span style={{ width: 26, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                        <Icon size={22} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{SOCIAL_LABELS[s.platform as SocialPlatform] || s.platform}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-faint-solid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {socialHandleLabel(s.platform as SocialPlatform, s.handle)}
                        </span>
                      </span>
                      <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
  )

  return (
    <div className="screen-in" style={{ maxWidth: 1040, margin: '0 auto' }}>
      {!isOwner && (
        <ProfileBackButton from={searchParams.from} fallback="/jobs" authed={!!user} />
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
            {mainContent}
          </div>
          {rail}
        </div>
      )}
    </div>
  )
}
