import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import CreatorAdminPanel, { type AdminCreatorRow } from '@/components/admin/CreatorAdminPanel'

// Concierge beta: seed creator profiles before the creator has an account,
// generate a secure one-time claim link to send them on Instagram/TikTok.
// Internal ops tool - not a dashboard, deliberately one simple page.
export default async function AdminCreatorsPage() {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: creators } = await admin.from('creator_profiles')
    .select(`
      id, display_name, bio, niche_tags, created_by_admin, internal_notes,
      created_at, slug, user_id, archived_at, onboarding_completed_at,
      users(display_name, email),
      social_accounts(platform, handle, follower_count),
      creator_claims(id, expires_at, used_at, revoked_at, created_at)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const creatorIds = (creators || []).map((c: any) => c.id)
  // "Which brands requested this creator" spans two states: pre-claim
  // (pending_collab_requests, a queue with its own admin-only outreach status)
  // and post-claim (campaign_invites, the real thing, whose status is the
  // creator's own accept/decline) - shown together with enough detail (brand,
  // campaign, status, date) to manage outreach without leaving this page.
  const [{ data: pendingRequests }, { data: realInvites }] = await Promise.all([
    creatorIds.length
      ? admin.from('pending_collab_requests')
          .select('id, creator_id, proposed_rate, status, created_at, campaigns(title), brand_profiles(company_name)')
          .in('creator_id', creatorIds).is('materialized_at', null)
      : Promise.resolve({ data: [] as any[] }),
    creatorIds.length
      ? admin.from('campaign_invites')
          .select('id, creator_id, proposed_rate, status, created_at, campaigns(title), brand_profiles(company_name)')
          .in('creator_id', creatorIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  type Request = AdminCreatorRow['requests'][number]
  const requestsByCreator = new Map<string, Request[]>()
  for (const r of pendingRequests || []) {
    const list = requestsByCreator.get(r.creator_id) || []
    list.push({
      id: r.id, kind: 'pending',
      brandName: (r.brand_profiles as any)?.company_name || 'A brand',
      campaignName: (r.campaigns as any)?.title || 'Untitled campaign',
      rate: r.proposed_rate, status: r.status, createdAt: r.created_at,
    })
    requestsByCreator.set(r.creator_id, list)
  }
  for (const r of realInvites || []) {
    const list = requestsByCreator.get(r.creator_id) || []
    list.push({
      id: r.id, kind: 'invite',
      brandName: (r.brand_profiles as any)?.company_name || 'A brand',
      campaignName: (r.campaigns as any)?.title || 'Untitled campaign',
      rate: r.proposed_rate, status: r.status, createdAt: r.created_at,
    })
    requestsByCreator.set(r.creator_id, list)
  }

  const rows: AdminCreatorRow[] = (creators || []).map((c: any) => {
    const activeClaim = (c.creator_claims || [])
      .filter((cl: any) => !cl.used_at && !cl.revoked_at && new Date(cl.expires_at) > new Date())
      .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0] || null
    return {
      id: c.id,
      displayName: c.users?.display_name || c.display_name || '(unnamed)',
      email: c.users?.email || null,
      bio: c.bio || '',
      nicheTags: c.niche_tags || [],
      internalNotes: c.internal_notes || '',
      claimed: Boolean(c.user_id),
      onboardingCompleted: Boolean(c.onboarding_completed_at),
      archived: Boolean(c.archived_at),
      createdByAdmin: Boolean(c.created_by_admin),
      slug: c.slug || null,
      socials: (c.social_accounts || []).map((s: any) => ({
        platform: s.platform, username: s.handle, followers: s.follower_count != null ? String(s.follower_count) : '',
      })),
      activeClaimExpiresAt: activeClaim?.expires_at || null,
      requests: (requestsByCreator.get(c.id) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }
  })

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Creators</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Seed a creator profile, then copy their claim link to send on Instagram/TikTok.
        </p>
      </div>
      <CreatorAdminPanel initialCreators={rows} />
    </div>
  )
}
