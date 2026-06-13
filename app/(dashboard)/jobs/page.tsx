import { createClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import EmptyState from '@/components/EmptyState'
import { Compass } from 'lucide-react'
import { bestFollowers } from '@/lib/fit'
import JobsList, { type JobsListCampaign } from '@/components/JobsList'

export default async function JobsPage() {
  const user = await requireCreator()
  const supabase = createClient()

  // The active campaign list (by status) and the signed-in creator's profile
  // (by user.id) are independent — batch them. The creator's niche + social
  // follower counts let the browse list compute a real fit score per campaign.
  const [{ data: campaigns }, { data: creator }] = await Promise.all([
    supabase.from('campaigns')
      .select('*, brand_profiles(company_name, logo_url)')
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('creator_profiles')
      .select('id, niche, niches').eq('user_id', user.id).single(),
  ])

  // Social follower counts + the creator's existing applications (to mark cards
  // already applied / selected) both key off the creator id — batch them.
  const [{ data: socials }, { data: myApps }] = await Promise.all([
    supabase.from('social_accounts').select('follower_count').eq('creator_id', creator?.id ?? ''),
    supabase.from('applications').select('campaign_id, status').eq('creator_id', creator?.id ?? ''),
  ])
  const appStatusByCampaign = new Map<string, string>()
  for (const a of myApps ?? []) appStatusByCampaign.set(a.campaign_id as string, a.status as string)

  const creatorContext = {
    niches: [creator?.niche, ...((creator?.niches as string[] | null) ?? [])]
      .filter((n): n is string => Boolean(n)),
    followers: bestFollowers((socials ?? []) as { follower_count: number | null }[]),
  }

  const list: JobsListCampaign[] = (campaigns ?? []).map(c => {
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
        <JobsList campaigns={list} creator={creatorContext} />
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
