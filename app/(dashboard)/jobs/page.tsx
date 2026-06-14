import { createClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import EmptyState from '@/components/EmptyState'
import { Compass } from 'lucide-react'
import { rankCampaignsForCreator } from '@/lib/recommend'
import { toCreatorSignals, toCampaignForCreator, type CreatorRow } from '@/lib/discovery-data'
import JobsList, { type JobsListCampaign } from '@/components/JobsList'

export default async function JobsPage() {
  const user = await requireCreator()
  const supabase = createClient()

  // The active campaign list (by status) and the signed-in creator's profile
  // (by user.id) are independent — batch them. The creator's niche, rate,
  // availability and social follower counts feed the two-sided recommender so
  // the browse list is ordered by real fit and labelled honestly.
  const [{ data: campaigns }, { data: creator }] = await Promise.all([
    supabase.from('campaigns')
      .select('*, brand_profiles(id, company_name, logo_url, completed_campaigns)')
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('creator_profiles')
      .select('id, niche, niches, niche_tags, average_rate_sgd, base_rate, availability_status, collabs_completed, rating_avg, rating_count, boost_active_until')
      .eq('user_id', user.id).single(),
  ])

  // Social accounts (followers + verified ownership), the creator's existing
  // applications, and the creator's score row all key off the creator id —
  // batch them.
  const [{ data: socials }, { data: myApps }, { data: scoreRow }] = await Promise.all([
    supabase.from('social_accounts').select('follower_count, verification_status').eq('creator_id', creator?.id ?? ''),
    supabase.from('applications').select('campaign_id, status').eq('creator_id', creator?.id ?? ''),
    supabase.from('creator_scores').select('*').eq('creator_id', creator?.id ?? '').maybeSingle(),
  ])
  const appStatusByCampaign = new Map<string, string>()
  for (const a of myApps ?? []) appStatusByCampaign.set(a.campaign_id as string, a.status as string)

  // Build the creator's ranking signals once; reuse for every campaign.
  const creatorRow: CreatorRow = (creator as CreatorRow | null) ?? { id: '' }
  const creatorSignals = toCreatorSignals(
    creatorRow,
    (socials ?? []) as { follower_count: number | null; verification_status: string | null }[],
    scoreRow,
  )

  // Rank active campaigns for this creator (best-first), then map each ranked
  // entry to the card props the list renders. The recommender already orders by
  // real fit, so we keep that order.
  const ranked = rankCampaignsForCreator(
    creatorSignals,
    (campaigns ?? []).map(c => {
      const brand = (c.brand_profiles as any) ?? null
      return toCampaignForCreator(c, brand?.completed_campaigns ?? 0)
    }),
  )
  const campaignById = new Map((campaigns ?? []).map(c => [c.id, c]))

  const list: JobsListCampaign[] = ranked.map(r => {
    const c = campaignById.get(r.campaign.id)!
    const brand = c.brand_profiles as { company_name: string | null; logo_url: string | null } | null
    // campaigns have no platform column; surface one only if present.
    const platform = typeof (c as { platform?: unknown }).platform === 'string'
      ? (c as { platform: string }).platform
      : null
    return {
      id: c.id,
      title: c.title,
      comp_type: c.comp_type,
      budget_min: c.budget_min,
      budget_max: c.budget_max,
      deadline: c.deadline,
      niche_tags: c.niche_tags,
      deliverable_types: c.deliverable_types,
      min_followers: c.min_followers ?? 0,
      creators_needed: c.creators_needed ?? 1,
      is_featured: Boolean(c.is_featured),
      platform,
      brand_name: brand?.company_name || 'Brand',
      brand_logo: brand?.logo_url ?? null,
      appliedStatus: (appStatusByCampaign.get(c.id) as JobsListCampaign['appliedStatus']) ?? null,
      // Honest fit signals from the recommender — tier label (or null) + reasons.
      matchLabel: r.label,
      matchReasons: r.reasons,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 880, margin: '0 auto' }}>
      {/* Header */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 7 }}>Opportunities</div>
        <h1 style={{ fontSize: 28 }}>Browse campaigns</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
          Ranked by fit with your niche, audience and rate — not just newest.
        </p>
      </div>

      {list.length > 0 ? (
        <JobsList campaigns={list} />
      ) : (
        <EmptyState
          icon={Compass}
          title="Fresh campaigns drop here daily"
          body="New briefs from brands hiring now are posted regularly. Check back soon — or polish your profile so you're ready to apply the moment one fits."
          actionHref="/profile"
          actionLabel="Complete your profile"
        />
      )}
    </div>
  )
}
