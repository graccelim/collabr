import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { getInitials, formatSGD } from '@/lib/utils'
import ReviewList, { type ReviewItem } from '@/components/ReviewList'
import RatingSummaryCard from '@/components/RatingSummaryCard'
import Link from 'next/link'
import { ChevronLeft, Globe, Briefcase, ShieldCheck, Pencil } from 'lucide-react'

export default async function BrandProfilePage({ params }: { params: { id: string } }) {
  const user = await requireAuth()
  const supabase = createClient()
  const admin = createAdminClient()

  // Brand identity + public reputation (public data → admin read is fine).
  const { data: brand } = await admin.from('brand_profiles')
    .select('id, user_id, company_name, company_description, industry, website, logo_url, completed_campaigns, rating_avg, rating_count, created_at')
    .eq('id', params.id).single()
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

  const showRating = (brand.rating_count || 0) >= 1
  const stats: [string, string, string][] = [
    ['Completed', String(brand.completed_campaigns || 0), 'campaigns on collabr'],
    ['Rating', showRating ? `${brand.rating_avg} ★` : '—', showRating ? `${brand.rating_count} creator${brand.rating_count !== 1 ? 's' : ''}` : 'no reviews yet'],
    ['Member', memberSince ? String(memberSince) : '—', 'on collabr since'],
  ]

  return (
    <div className="screen-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      {isOwner ? (
        <div className="eyebrow" style={{ marginBottom: 22, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-deep)' }}>
          <ShieldCheck size={13} /> This is how creators see you
        </div>
      ) : (
        <Link href="/jobs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-faint-solid)', marginBottom: 28 }}>
          <ChevronLeft size={15} /> Campaigns
        </Link>
      )}

      {/* identity — airy hero, hairline-divided stat strip below */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 26 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', minWidth: 0 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 22, flexShrink: 0, overflow: 'hidden',
            background: brand.logo_url ? '#fff' : 'linear-gradient(135deg, #7C72FF 0%, #5B53E0 60%, #4338CA 100%)',
            color: '#fff',
            boxShadow: '0 0 0 1px var(--line), 0 8px 24px -10px rgba(67,56,202,.35)',
            display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em',
          }}>
            {brand.logo_url
              ? <img src={brand.logo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : getInitials(name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <h1 className="display-face" style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{name}</h1>
              {brand.industry && <span className="badge badge-neutral" style={{ fontSize: 11 }}>{brand.industry}</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginTop: 9, fontSize: 13, color: 'var(--ink-faint-solid)' }}>
              {memberSince && <span>Member since {memberSince}</span>}
              {brand.website && (
                <a href={brand.website} target="_blank" rel="noopener noreferrer nofollow"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-deep)', fontWeight: 600 }}>
                  <Globe size={13} /> Website
                </a>
              )}
            </div>
          </div>
        </div>
        {isOwner && (
          <Link href="/settings" className="btn-primary" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Pencil size={15} /> Edit profile
          </Link>
        )}
      </div>

      {/* stat strip — clean, borderless, hairline dividers */}
      <div className="resp-stats" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 36,
        borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '20px 0',
      }}>
        {stats.map(([k, v, ctx], i) => (
          <div key={k} style={{ padding: i === 0 ? '0 22px 0 2px' : '0 22px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
            <div className="mono-num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{v}</div>
            <div className="eyebrow" style={{ fontSize: 10, marginTop: 7 }}>{k}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 3 }}>{ctx}</div>
          </div>
        ))}
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
        emptyTitle={isOwner ? 'No reviews yet — let’s change that' : 'No reviews yet'}
        emptyBody={isOwner
          ? 'Run your first collaboration and creators’ reviews will show up here, building the trust that wins you better creators.'
          : 'Reviews from creators appear after completed collaborations, revealed once both sides submit or after 7 days.'}
        ctaHref={isOwner ? '/post-job' : undefined}
        ctaLabel={isOwner ? 'Post a campaign' : undefined}
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
    </div>
  )
}
