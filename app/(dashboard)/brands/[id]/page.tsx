import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { getInitials, formatSGD } from '@/lib/utils'
import ReputationSummary from '@/components/ReputationSummary'
import ReviewList, { type ReviewItem } from '@/components/ReviewList'
import RatingSummaryCard from '@/components/RatingSummaryCard'
import Link from 'next/link'
import { ChevronLeft, Globe, Briefcase, ShieldCheck } from 'lucide-react'

export default async function BrandProfilePage({ params }: { params: { id: string } }) {
  await requireAuth()
  const supabase = createClient()
  const admin = createAdminClient()

  // Brand identity + public reputation (public data → admin read is fine).
  const { data: brand } = await admin.from('brand_profiles')
    .select('id, company_name, company_description, industry, website, logo_url, completed_campaigns, rating_avg, rating_count, created_at')
    .eq('id', params.id).single()
  if (!brand) return <p className="text-sm" style={{ color: 'var(--danger)' }}>Brand not found.</p>

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

  return (
    <div className="screen-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      <Link href="/jobs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-faint-solid)', marginBottom: 22 }}>
        <ChevronLeft size={15} /> Campaigns
      </Link>

      {/* Identity */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 'var(--radius-sm)', flexShrink: 0, overflow: 'hidden',
          background: 'var(--paper-2)', border: '1px solid var(--line)',
          display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 20, color: 'var(--ink-soft)',
        }}>
          {brand.logo_url
            ? <img src={brand.logo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : getInitials(name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 className="h1" style={{ fontSize: 25, fontWeight: 600 }}>{name}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 5, fontSize: 13, color: 'var(--ink-faint-solid)' }}>
            {brand.industry && <span>{brand.industry}</span>}
            {memberSince && <span>Member since {memberSince}</span>}
            {brand.website && (
              <a href={brand.website} target="_blank" rel="noopener noreferrer nofollow"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-deep)' }}>
                <Globe size={13} /> Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Reputation summary (premium empty state for new brands) */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={13} /> Reputation
        </div>
        <ReputationSummary
          ratingAvg={brand.rating_avg}
          ratingCount={brand.rating_count}
          completed={brand.completed_campaigns}
          completedLabel="completed campaigns"
          emptyBody="This brand is building its reputation on collabr. Reviews from creators appear after completed collaborations."
        />
      </div>

      {/* About */}
      {brand.company_description && (
        <section style={{ marginBottom: 28 }}>
          <h2 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>About</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
            {brand.company_description}
          </p>
        </section>
      )}

      {/* Revealed reviews from creators */}
      {reviews.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <RatingSummaryCard avg={brand.rating_avg} count={brand.rating_count} distribution={dist} totalReviews={reviews.length} />
        </div>
      )}
      <ReviewList
        reviews={reviews}
        heading="What creators say"
        emptyBody="No reviews yet — feedback from creators appears after completed collaborations, revealed once both sides submit or after 7 days."
      />

      {/* Active campaigns */}
      {campaigns && campaigns.length > 0 && (
        <section style={{ marginBottom: 10 }}>
          <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>Open campaigns</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campaigns.map(c => {
              const budget = c.budget_min && c.budget_max
                ? `${formatSGD(c.budget_min)}–${formatSGD(c.budget_max)}`
                : c.comp_type === 'barter' ? 'Barter' : 'Negotiable'
              return (
                <Link key={c.id} href={`/jobs/${c.id}`} className="card card-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Briefcase size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  </span>
                  <span className="mono-num" style={{ fontSize: 13, color: 'var(--ink-soft)', flexShrink: 0 }}>{budget}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
