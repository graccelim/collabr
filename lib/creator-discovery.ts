import type { createClient, createAdminClient } from '@/lib/supabase/server'
import { rankCreators } from '@/lib/recommend'
import { toCreatorSignals, type ScoreRow } from '@/lib/discovery-data'
import { NICHE_LABELS, extractHandle, type CreatorNiche, type SocialPlatform } from '@/lib/onboarding'
import type { SocialAccount } from '@/types'

type Supabase = ReturnType<typeof createClient>
type Admin = ReturnType<typeof createAdminClient>

export const DISCOVERY_PAGE_SIZE = 12
// Candidate pool ranked in memory before paginating (and, below, before the
// text search). Comfortably covers beta scale; if a filter ever matches more,
// the top CANDIDATE_CAP by DB order rank.
const CANDIDATE_CAP = 300

export interface DiscoveryParams {
  platform?: string
  niche?: string
  followers?: string
  availability?: string
  maxRate?: string
  location?: string
  saved?: string
  certified?: string
  sort?: string
  page?: string
  /** Free-text search over name, handle, and niche - see the in-memory match
   *  below for why this isn't a DB-side filter. */
  q?: string
}

export interface DiscoveryCreatorRow {
  id: string
  slug: string | null
  user_id: string | null
  display_name: string | null
  bio: string | null
  niche: string | null
  niches: string[] | null
  niche_tags: string[] | null
  location: string | null
  average_rate_sgd: number | null
  availability_status: string | null
  base_rate: number | null
  onboarding_completed_at: string | null
  certified: boolean | null
  connected: boolean | null
  insights_last_synced_at: string | null
  boost_active_until: string | null
  rating_avg: number | null
  rating_count: number | null
  collabs_completed: number | null
  created_at: string
  // Supabase's typed client infers a to-one embedded relation as an array
  // when it can't see the FK at the type level - `any` here matches the
  // `as any` cast used at every other creator_profiles.users join in the app.
  users: any
}

export interface DiscoveryResult {
  pageCreators: DiscoveryCreatorRow[]
  socialsByCreator: Record<string, SocialAccount[]>
  scoreById: Record<string, ScoreRow>
  savedSet: Set<string>
  total: number
  totalPages: number
  page: number
}

const DISCOVERY_SELECT = 'id, slug, user_id, display_name, bio, niche, niches, niche_tags, location, average_rate_sgd, availability_status, base_rate, onboarding_completed_at, certified, connected, insights_last_synced_at, boost_active_until, rating_avg, rating_count, collabs_completed, created_at, users(display_name, avatar_url)'

/**
 * Shared creator-discovery query - filters, candidate fetch, ranking,
 * pagination, and (below) free-text search. Used by BOTH the authenticated
 * Brand Plus dashboard page (/creators, brandId = the viewing brand) and the
 * public unauthenticated browse page (/browse, brandId = null, which simply
 * skips anything saved-creator-related). One query, one ranking pass, one
 * place that knows how creator discovery works - not two parallel
 * implementations that could drift.
 */
export async function runCreatorDiscovery(
  supabase: Supabase,
  admin: Admin,
  params: DiscoveryParams,
  brandId: string | null,
): Promise<DiscoveryResult> {
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const from = (page - 1) * DISCOVERY_PAGE_SIZE

  // ── Pre-filters that resolve to creator-id sets ────────────────────────────
  let idFilter: string[] | null = null

  const minFollowers = parseInt(params.followers || '', 10)
  if (params.platform || minFollowers > 0) {
    let saQuery = supabase.from('social_accounts').select('creator_id')
    if (params.platform) saQuery = saQuery.eq('platform', params.platform)
    if (minFollowers > 0) saQuery = saQuery.gte('follower_count', minFollowers)
    const { data: matches } = await saQuery.limit(5000)
    idFilter = Array.from(new Set((matches || []).map((m: any) => m.creator_id)))
  }

  if (params.saved === '1' && brandId) {
    const { data: saved } = await supabase.from('saved_creators').select('creator_id').eq('brand_id', brandId)
    const savedIds = (saved || []).map((s: any) => s.creator_id)
    idFilter = idFilter ? idFilter.filter(id => savedIds.includes(id)) : savedIds
  }

  // ── Main query ──────────────────────────────────────────────────────────────
  // Admin client: creator profiles are public data, but the users join
  // (display name / avatar) is RLS-limited to own-row for session clients.
  // archived_at IS NULL - archiving hides a creator from discovery/search,
  // the one place that check actually needs to live for it to mean anything.
  let query = admin.from('creator_profiles')
    .select(DISCOVERY_SELECT, { count: 'exact' })
    .is('archived_at', null)

  if (idFilter) {
    if (idFilter.length === 0) query = query.eq('id', '00000000-0000-0000-0000-000000000000') // no matches
    else query = query.in('id', idFilter)
  }
  if (params.niche) query = query.eq('niche', params.niche)
  if (params.certified === '1') query = query.eq('certified', true)
  if (params.availability) query = query.eq('availability_status', params.availability)
  if (params.location) query = query.ilike('location', `%${params.location}%`)
  const maxRate = parseInt(params.maxRate || '', 10)
  if (maxRate > 0) query = query.lte('average_rate_sgd', maxRate * 100)

  switch (params.sort) {
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
    default: // most relevant - re-ranked in memory below; DB order is a fallback
      query = query
        .order('boost_active_until', { ascending: false, nullsFirst: false })
        .order('rating_avg', { ascending: false })
        .order('collabs_completed', { ascending: false })
  }

  // Fetch the whole candidate pool (capped), then rank/search BEFORE
  // paginating so the best/most-matching results surface on page 1.
  const { data: creatorsRaw } = await query.limit(CANDIDATE_CAP)
  const creators = (creatorsRaw || []) as DiscoveryCreatorRow[]

  const candidateIds = creators.map(c => c.id)
  const socialsByCreator: Record<string, SocialAccount[]> = {}
  const scoreById: Record<string, ScoreRow> = {}
  let savedSet = new Set<string>()
  if (candidateIds.length > 0) {
    const [{ data: socials }, { data: scores }, savedRes] = await Promise.all([
      supabase.from('social_accounts')
        .select('id, creator_id, platform, handle, url, follower_count, is_primary, created_at, updated_at')
        .in('creator_id', candidateIds)
        .order('is_primary', { ascending: false })
        .order('follower_count', { ascending: false, nullsFirst: false }),
      admin.from('creator_scores')
        .select('creator_id, quality_score, reliability_score, response_rate_shrunk, response_rate, invites_concluded')
        .in('creator_id', candidateIds),
      brandId
        ? admin.from('saved_creators').select('creator_id').eq('brand_id', brandId).in('creator_id', candidateIds)
        : Promise.resolve({ data: [] as { creator_id: string }[] }),
    ])
    for (const s of (socials || []) as SocialAccount[]) (socialsByCreator[s.creator_id] ||= []).push(s)
    for (const sc of (scores || []) as (ScoreRow & { creator_id: string })[]) scoreById[sc.creator_id] = sc
    if (brandId) {
      const { data: saved } = savedRes
      savedSet = new Set((saved || []).map(s => s.creator_id))
    }
  }

  // Free-text search - name (claimed or pre-claim), handle, or niche. Done in
  // memory over the already-fetched candidate pool rather than as a DB filter:
  // the match spans two different name columns (users.display_name post-claim,
  // creator_profiles.display_name pre-claim) plus social_accounts.handle, which
  // would need a view or RPC to do as a single indexed query. At beta scale
  // (the whole pool already fits in CANDIDATE_CAP) this is simpler and just as
  // fast; revisit with real DB-side search if the roster outgrows that.
  const q = (params.q || '').trim().toLowerCase()
  const searched = q ? creators.filter(c => {
    const name = (c.users?.display_name || c.display_name || '').toLowerCase()
    if (name.includes(q)) return true
    const niches = [c.niche, ...(c.niche_tags || [])].filter(Boolean) as string[]
    if (niches.some(n => (NICHE_LABELS[n as CreatorNiche] || n).toLowerCase().includes(q))) return true
    return (socialsByCreator[c.id] || []).some(s => s.handle.toLowerCase().includes(q))
  }) : creators

  // "Most relevant" (no explicit sort) is re-ranked in memory; an explicit
  // sort (Newest, Highest rated, …) honours the DB order instead - otherwise
  // the in-memory re-rank would silently override the brand's own choice.
  const hasExplicitSort = Boolean(params.sort)
  const ranked = hasExplicitSort ? [...searched] : (() => {
    const rankOrder = new Map(
      rankCreators(searched.map(c => toCreatorSignals(c as any, socialsByCreator[c.id] || [], scoreById[c.id] || null)), null)
        .map((r, i) => [r.creator.id, i])
    )
    return [...searched].sort((a, b) => (rankOrder.get(a.id) ?? 0) - (rankOrder.get(b.id) ?? 0))
  })()

  const total = ranked.length
  const totalPages = Math.max(1, Math.ceil(total / DISCOVERY_PAGE_SIZE))
  const pageCreators = ranked.slice(from, from + DISCOVERY_PAGE_SIZE)

  return { pageCreators, socialsByCreator, scoreById, savedSet, total, totalPages, page }
}

/**
 * Platform + handle -> creator lookup for /join's creator-activation flow.
 * The precise counterpart to the free-text `q` search above: a handle a
 * creator types about themselves is exact (unlike a guessed display name), so
 * this is a direct social_accounts match, not a ranked/fuzzy one - reuses
 * extractHandle for the same @/URL normalization the admin form and bulk
 * import already apply, so "my own handle" always resolves the same way
 * regardless of how it was typed in either direction.
 */
export async function findCreatorBySocial(
  admin: Admin, platform: SocialPlatform, rawHandle: string,
): Promise<{ id: string; user_id: string | null } | null> {
  const handle = extractHandle(platform, rawHandle)
  if (!handle) return null
  const { data: social } = await admin.from('social_accounts')
    .select('creator_id').eq('platform', platform).eq('handle', handle).maybeSingle()
  if (!social) return null
  const { data: creator } = await admin.from('creator_profiles')
    .select('id, user_id').eq('id', social.creator_id).maybeSingle()
  return creator
}
