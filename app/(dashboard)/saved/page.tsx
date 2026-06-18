import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import EmptyState from '@/components/EmptyState'
import { Bookmark, ArrowLeft } from 'lucide-react'
import JobsList, { type JobsListCampaign } from '@/components/JobsList'

export default async function SavedCampaignsPage() {
  const user = await requireCreator()
  const supabase = createClient()
  const { data: creator } = await supabase
    .from('creator_profiles').select('id').eq('user_id', user.id).single()
  const creatorId = creator?.id ?? ''

  // Saved bookmarks (newest first) with their campaign + brand, and the creator's
  // application statuses so the cards show "Applied"/"Selected" where relevant.
  const [{ data: savedRows }, { data: myApps }] = await Promise.all([
    supabase
      .from('saved_campaigns')
      .select(
        'campaign_id, created_at, campaigns(id, slug, title, comp_type, budget_min, budget_max, deadline, niche_tags, deliverable_types, min_followers, creators_needed, is_featured, status, brand_profiles(company_name, logo_url, rating_avg, rating_count))'
      )
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false }),
    supabase.from('applications').select('campaign_id, status').eq('creator_id', creatorId),
  ])
  const appStatus = new Map<string, string>()
  for (const a of myApps ?? []) appStatus.set(a.campaign_id as string, a.status as string)

  // Only active briefs are actionable; a saved campaign that has since closed is
  // dropped from the list rather than dead-ending on the detail page.
  const list: JobsListCampaign[] = (savedRows ?? [])
    .map((r) => r.campaigns as any)
    .filter((c) => c && c.status === 'active')
    .map((c) => {
      const brand = c.brand_profiles as any
      const platform = typeof c.platform === 'string' ? c.platform : null
      return {
        id: c.id,
        slug: c.slug,
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
        brand_rating_avg: brand?.rating_avg ?? null,
        brand_rating_count: brand?.rating_count ?? null,
        appliedStatus: (appStatus.get(c.id) as JobsListCampaign['appliedStatus']) ?? null,
        // No fit ranking on the saved list - these are the creator's own picks.
        matchLabel: null,
        matchReasons: [],
        saved: true,
      }
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 880, margin: '0 auto' }}>
      <div>
        <Link
          href="/jobs"
          className="eyebrow"
          style={{ marginBottom: 7, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-faint-solid)' }}
        >
          <ArrowLeft size={12} /> Browse all campaigns
        </Link>
        <h1 style={{ fontSize: 28 }}>Your saved campaigns</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
          Campaigns you bookmarked to apply to later. Only active briefs are shown.
        </p>
      </div>

      {list.length > 0 ? (
        <JobsList campaigns={list} />
      ) : (
        <EmptyState
          icon={Bookmark}
          title="No saved campaigns yet"
          body="Tap the bookmark on any campaign to save it here, so you can come back and apply when you're ready."
          actionHref="/jobs"
          actionLabel="Discover campaigns"
        />
      )}
    </div>
  )
}
