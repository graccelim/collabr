import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import ReviewList, { type ReviewItem } from '@/components/ReviewList'
import RatingSummaryCard from '@/components/RatingSummaryCard'
import ProfileBackButton from '@/components/ProfileBackButton'
import { chipColor } from '@/lib/niches'
import { INDUSTRY_LABELS, SOCIAL_LABELS, socialHandleLabel, type BrandIndustry, type SocialPlatform } from '@/lib/onboarding'
import { socialIcon } from '@/components/SocialIcon'
import ProfileStats, { type ProfileStat } from '@/components/ProfileStats'
import Link from 'next/link'
import { Globe, Briefcase, ShieldCheck, Pencil, MapPin, ExternalLink, Star, CalendarDays, CheckCircle2 } from 'lucide-react'

export default async function BrandProfilePage({ params, searchParams }: { params: { id: string }; searchParams: { from?: string } }) {
  const user = await requireAuth()
  const supabase = createClient()
  const admin = createAdminClient()

  // Brand identity + public reputation (public data → admin read is fine).
  const BRAND_COLS = 'id, user_id, company_name, company_description, industry, website, logo_url, completed_campaigns, rating_avg, rating_count, created_at'
  // `location` is newer (migration 020). Tolerate DBs where it isn't applied yet
  // so brand profiles never 404 during the migration window.
  let brand: any = null
  {
    const r = await admin.from('brand_profiles').select(`${BRAND_COLS}, location, social_url, socials`).eq('id', params.id).single()
    brand = r.data
  }
  if (!brand) {
    const r = await admin.from('brand_profiles').select(`${BRAND_COLS}, location, social_url`).eq('id', params.id).single()
    brand = r.data
  }
  if (!brand) {
    const r = await admin.from('brand_profiles').select(BRAND_COLS).eq('id', params.id).single()
    brand = r.data
  }
  if (!brand) return <p className="text-sm" style={{ color: 'var(--danger)' }}>Brand not found.</p>
  const isOwner = brand.user_id === user.id

  // REVEALED reviews + active campaigns. Reviews go through the SESSION client so
  // the double-blind reveal RLS is enforced (admin would bypass it).
  const [{ data: reviewRows }, { data: campaigns }] = await Promise.all([
    supabase.from('reviews')
      .select('id, rating, note, created_at, collabs!inner(brand_id, campaigns(title), creator_profiles(users(display_name)))')
      .eq('reviewer_type', 'creator')
      .eq('collabs.brand_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('campaigns')
      .select('id, title, comp_type, budget_min, budget_max, niche_tags')
      .eq('brand_id', params.id).eq('status', 'active')
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

  // Reasons a creator should work with this brand (escrow is honest + enticing
  // here, since the creator is the one reading it).
  const brandTrust: string[] = ['Payment secured in escrow before you start']
  if ((brand.completed_campaigns || 0) > 0) brandTrust.push(`${brand.completed_campaigns} completed campaign${brand.completed_campaigns !== 1 ? 's' : ''} on collabr`)

  const showRating = (brand.rating_count || 0) >= 1
  if (showRating) brandTrust.push(`${brand.rating_avg}★ from ${brand.rating_count} creator${brand.rating_count !== 1 ? 's' : ''}`)

  const stats: ProfileStat[] = [
    { label: 'Completed', value: String(brand.completed_campaigns || 0), sub: 'campaigns on collabr', icon: Briefcase, tone: 'accent' },
    { label: 'Rating', value: showRating ? String(brand.rating_avg) : '–', sub: showRating ? `${brand.rating_count} creator${brand.rating_count !== 1 ? 's' : ''}` : 'no reviews yet', icon: Star, tone: 'warn' },
    { label: 'Member', value: memberSince ? String(memberSince) : '–', sub: 'on collabr since', icon: CalendarDays, tone: 'neutral' },
  ]

  return (
    <div className="screen-in" style={{ maxWidth: 940, margin: '0 auto' }}>
      {isOwner ? (
        <div className="eyebrow" style={{ marginBottom: 22, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-deep)' }}>
          <ShieldCheck size={13} /> This is how creators see you
        </div>
      ) : (
        <ProfileBackButton from={searchParams.from} fallback="/jobs" />
      )}

      {/* identity - airy hero, hairline-divided stat strip below */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 26 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', minWidth: 0 }}>
          <Avatar src={brand.logo_url} name={name} size={88} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <h1 className="display-face" style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{name}</h1>
              {brand.industry && (() => {
                const c = chipColor(brand.industry)
                return <span className="badge" style={{ fontSize: 11, background: c.bg, color: c.fg, fontWeight: 600 }}>{INDUSTRY_LABELS[brand.industry as BrandIndustry] || brand.industry}</span>
              })()}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginTop: 9, fontSize: 13, color: 'var(--ink-faint-solid)' }}>
              {brand.location && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={13} />{brand.location}
                </span>
              )}
              {memberSince && <span>Member since {memberSince}</span>}
            </div>
          </div>
        </div>
        {isOwner && (
          <Link href="/settings" className="btn-primary" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Pencil size={15} /> Edit profile
          </Link>
        )}
      </div>

      {/* premium stat band */}
      <div style={{ marginBottom: 36 }}>
        <ProfileStats stats={stats} />
      </div>

      {/* two-column: content + side rail (website + socials, like the creator page) */}
      <div className="pc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 40, alignItems: 'start' }}>
        {/* MAIN */}
        <div>
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

          {/* Open campaigns */}
          {campaigns && campaigns.length > 0 && (
            <section style={{ marginBottom: 30 }}>
              <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>Open campaigns</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {campaigns.map(c => {
                  const budget = c.budget_min && c.budget_max
                    ? `${formatSGD(c.budget_min)}–${formatSGD(c.budget_max)}`
                    : c.comp_type === 'barter' ? 'Barter' : 'Negotiable'
                  return (
                    <Link key={c.id} href={`/jobs/${c.id}`} className="card card-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
                          <Briefcase size={16} />
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      </span>
                      <span className="badge badge-money" style={{ flexShrink: 0, fontSize: 12 }}>{budget}</span>
                    </Link>
                  )
                })}
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
              ? 'Run your first collaboration and creators’ reviews will show up here, building the trust that wins you better creators.'
              : 'Reviews from creators appear after completed collaborations, revealed once both sides submit or after 7 days.'}
            ctaHref={isOwner ? '/post-job' : undefined}
            ctaLabel={isOwner ? 'Post a campaign' : undefined}
          />
        </div>

        {/* RAIL - why work with this brand + where to find them */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Working with {name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {brandTrust.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--money)', flexShrink: 0 }} /> {p}
                </div>
              ))}
            </div>
          </div>

          {(brand.website || brandSocials.length > 0) && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Find {name} online</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {brand.website && (
                  <a href={brand.website} target="_blank" rel="noopener noreferrer nofollow"
                    className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', textDecoration: 'none' }}>
                    <span style={{ width: 30, flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-soft)' }}>
                      <Globe size={20} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Website</span>
                    <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                  </a>
                )}
                {brandSocials.map((s: any) => {
                  const Icon = socialIcon(s.platform)
                  return (
                    <a key={s.platform + s.handle} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', textDecoration: 'none' }}>
                      <span style={{ width: 30, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                        <Icon size={24} />
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
      </div>
    </div>
  )
}
