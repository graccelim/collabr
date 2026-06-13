import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import Link from 'next/link'
import { Suspense } from 'react'
import { formatSGD, getInitials } from '@/lib/utils'
import { NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'
import { AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles'
import CreatorFilters from '@/components/CreatorFilters'
import SaveCreatorButton from '@/components/SaveCreatorButton'
import EmptyState from '@/components/EmptyState'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'
import { Users, Star, BadgeCheck, Sparkles } from 'lucide-react'
import type { SocialAccount } from '@/types'

const PAGE_SIZE = 12

interface Search {
  platform?: string
  niche?: string
  followers?: string
  availability?: string
  maxRate?: string
  verified?: string
  location?: string
  saved?: string
  sort?: string
  page?: string
}

export default async function CreatorsPage({ searchParams }: { searchParams: Search }) {
  const user = await requireBrand()
  const supabase = createClient()
  const admin = createAdminClient()

  // Admin client: subscription columns are server-only; own row by user_id.
  const { data: brand } = await admin.from('brand_profiles')
    .select(`id, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()

  // Creator Discovery is a Pro feature — complimentary for every brand while
  // in beta. In paid mode, Free brands see a calm gate (no pricing, no modal).
  const plan = resolvePlan(brand)
  if (!plan.isPro) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Browse creators</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon"><Sparkles size={18} /></div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            Creator Discovery is part of collabr Pro
          </h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
            Search, filter, save, and directly invite creators with Pro. Your campaigns and
            applications continue to work as usual on the Free plan.
          </p>
          <Link href="/billing" className="btn-primary" style={{ marginTop: 14 }}>Manage plan</Link>
        </div>
      </div>
    )
  }

  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  // ── Pre-filters that resolve to creator-id sets ────────────────────────────
  // Platform / followers live on social_accounts: a creator qualifies when at
  // least one (matching) account meets the follower threshold.
  let idFilter: string[] | null = null

  const minFollowers = parseInt(searchParams.followers || '', 10)
  if (searchParams.platform || minFollowers > 0) {
    let saQuery = supabase.from('social_accounts').select('creator_id')
    if (searchParams.platform) saQuery = saQuery.eq('platform', searchParams.platform)
    if (minFollowers > 0) saQuery = saQuery.gte('follower_count', minFollowers)
    const { data: matches } = await saQuery.limit(5000)
    idFilter = Array.from(new Set((matches || []).map(m => m.creator_id)))
  }

  if (searchParams.saved === '1' && brand) {
    const { data: saved } = await supabase.from('saved_creators')
      .select('creator_id').eq('brand_id', brand.id)
    const savedIds = (saved || []).map(s => s.creator_id)
    idFilter = idFilter ? idFilter.filter(id => savedIds.includes(id)) : savedIds
  }

  // ── Main query ──────────────────────────────────────────────────────────────
  // Admin client: creator profiles are public data, but the users join
  // (display name / avatar) is RLS-limited to own-row for session clients.
  let query = admin.from('creator_profiles')
    .select('id, user_id, bio, niche, niches, location, average_rate_sgd, availability_status, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, created_at, users(display_name, avatar_url)', { count: 'exact' })

  if (idFilter) {
    if (idFilter.length === 0) {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000') // no matches
    } else {
      query = query.in('id', idFilter)
    }
  }
  if (searchParams.niche) query = query.eq('niche', searchParams.niche)
  if (searchParams.availability) query = query.eq('availability_status', searchParams.availability)
  if (searchParams.verified === '1') query = query.eq('is_verified', true)
  if (searchParams.location) query = query.ilike('location', `%${searchParams.location}%`)
  const maxRate = parseInt(searchParams.maxRate || '', 10)
  if (maxRate > 0) query = query.lte('average_rate_sgd', maxRate * 100)

  switch (searchParams.sort) {
    case 'rating':
      query = query.order('rating_avg', { ascending: false }).order('rating_count', { ascending: false })
      break
    case 'collabs':
      query = query.order('collabs_completed', { ascending: false })
      break
    case 'rate_low':
      query = query.order('average_rate_sgd', { ascending: true, nullsFirst: false })
      break
    case 'rate_high':
      query = query.order('average_rate_sgd', { ascending: false, nullsFirst: false })
      break
    case 'newest':
      query = query.order('created_at', { ascending: false })
      break
    default: // most relevant
      query = query
        .order('is_verified', { ascending: false })
        .order('boost_active_until', { ascending: false, nullsFirst: false })
        .order('rating_avg', { ascending: false })
        .order('collabs_completed', { ascending: false })
  }

  const { data: creators, count } = await query.range(from, from + PAGE_SIZE - 1)
  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Primary social accounts + saved state for this page of results.
  const pageIds = (creators || []).map(c => c.id)
  const socialsByCreator: Record<string, SocialAccount[]> = {}
  let savedSet = new Set<string>()
  if (pageIds.length > 0) {
    const { data: socials } = await supabase.from('social_accounts')
      .select('*').in('creator_id', pageIds)
      .order('is_primary', { ascending: false })
      .order('follower_count', { ascending: false, nullsFirst: false })
    for (const s of (socials || []) as SocialAccount[]) {
      (socialsByCreator[s.creator_id] ||= []).push(s)
    }
    if (brand) {
      const { data: saved } = await admin.from('saved_creators')
        .select('creator_id').eq('brand_id', brand.id).in('creator_id', pageIds)
      savedSet = new Set((saved || []).map(s => s.creator_id))
    }
  }

  function pageHref(p: number) {
    const entries = Object.entries(searchParams)
      .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '')
    const next = new URLSearchParams(entries)
    if (p <= 1) next.delete('page')
    else next.set('page', String(p))
    const qs = next.toString()
    return `/creators${qs ? `?${qs}` : ''}`
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }} className="space-y-6">
      {/* header */}
      <div>
        <h1 className="h1" style={{ fontSize: 24, fontWeight: 600 }}>Discover creators</h1>
        <p style={{ marginTop: 6, fontSize: 14.5, color: 'var(--ink-soft)' }}>
          {total} verified creator{total !== 1 ? 's' : ''}{searchParams.saved === '1' ? ' saved' : ' on collabr'} · browse, save a shortlist, and invite to your campaigns.
        </p>
      </div>

      <Suspense>
        <CreatorFilters showSaved />
      </Suspense>

      {(!creators || creators.length === 0) ? (
        <EmptyState
          icon={Users}
          title={searchParams.saved === '1' ? 'No saved creators yet' : 'No creators match these filters'}
          body={searchParams.saved === '1'
            ? 'Tap the bookmark on any creator to build your shortlist for future campaigns.'
            : 'Try broadening your filters — fewer constraints usually surface great creators you might otherwise miss.'}
          actionHref="/creators"
          actionLabel={searchParams.saved === '1' ? 'Browse all creators' : 'Clear filters'}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {creators.map(c => {
            const name = (c.users as any)?.display_name || 'Creator'
            const avatar = (c.users as any)?.avatar_url
            const socials = socialsByCreator[c.id] || []
            const primary = socials[0]
            const rate = c.average_rate_sgd ?? c.base_rate
            const availability = (c.availability_status as AvailabilityStatus) || 'available'
            const isBoosted = c.boost_active_until && new Date(c.boost_active_until) > new Date()
            const primaryNiche = c.niche
              ? NICHE_LABELS[c.niche as CreatorNiche] || c.niche
              : c.niches?.[0]
            const totalFollowers = socials.reduce((sum, s) => sum + (s.follower_count || 0), 0)

            return (
              <Link
                key={c.id}
                href={`/creators/${c.id}`}
                className="card card-hover"
                style={{ display: 'flex', flexDirection: 'column', padding: 18 }}
              >
                {/* top: avatar + save */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                    background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 15,
                  }}>
                    {avatar
                      ? <img src={avatar} alt={name} style={{ width: 46, height: 46, objectFit: 'cover' }} />
                      : getInitials(name)}
                  </div>
                  <SaveCreatorButton creatorId={c.id} initialSaved={savedSet.has(c.id)} compact />
                </div>

                {/* name + verified + availability dot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 13 }}>
                  <span style={{ fontWeight: 600, fontSize: 15.5, letterSpacing: '-0.01em', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                  {c.is_verified && <BadgeCheck size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  {availability === 'available' && (
                    <span title="Available" style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--money)', flexShrink: 0, marginLeft: 2 }} />
                  )}
                </div>

                {/* handle · niche */}
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {primary ? `@${primary.handle}` : (c.location || 'collabr creator')}
                  {primaryNiche ? ` · ${primaryNiche}` : ''}
                </div>

                {/* bio */}
                <div style={{
                  fontSize: 13, marginTop: 11, color: 'var(--ink-soft)', lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', minHeight: 39,
                }}>
                  {c.bio || `${primaryNiche ? primaryNiche + ' creator' : 'Creator'}${c.location ? ` based in ${c.location}` : ''}.`}
                </div>

                {/* followers + rate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  <span className="mono-num" style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {totalFollowers > 0
                      ? <>{totalFollowers.toLocaleString()}<span style={{ color: 'var(--ink-faint-solid)' }}> followers</span></>
                      : <span style={{ color: 'var(--ink-faint-solid)' }}>No socials yet</span>}
                  </span>
                  <span className="mono-num" style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {rate > 0 ? `from ${formatSGD(rate)}` : 'Negotiable'}
                  </span>
                </div>

                {/* footer: rating / collabs + availability/boost badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-faint-solid)' }}>
                    {c.rating_count > 0
                      ? <><Star size={11} fill="currentColor" style={{ color: 'var(--warn)' }} /> {c.rating_avg} · {c.collabs_completed} collab{c.collabs_completed !== 1 ? 's' : ''}</>
                      : c.collabs_completed > 0
                        ? `${c.collabs_completed} collab${c.collabs_completed !== 1 ? 's' : ''}`
                        : 'New to collabr'}
                  </span>
                  <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {isBoosted && <span className="badge badge-accent" style={{ fontSize: 10.5 }}>Boosted</span>}
                    <span className={`badge ${availability === 'available' ? 'badge-safe' : availability === 'limited' ? 'badge-warn' : 'badge-neutral'}`} style={{ fontSize: 10.5 }}>
                      {AVAILABILITY_LABELS[availability]}
                    </span>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 8 }}>
          {page > 1
            ? <Link href={pageHref(page - 1)} className="btn-secondary btn-sm">← Previous</Link>
            : <span className="btn-secondary btn-sm" style={{ opacity: .4, pointerEvents: 'none' }}>← Previous</span>}
          <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Page {page} of {totalPages}</span>
          {page < totalPages
            ? <Link href={pageHref(page + 1)} className="btn-secondary btn-sm">Next →</Link>
            : <span className="btn-secondary btn-sm" style={{ opacity: .4, pointerEvents: 'none' }}>Next →</span>}
        </div>
      )}
    </div>
  )
}
