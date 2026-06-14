import { bestFollowers } from '@/lib/fit'
import { boostEnabled } from '@/lib/stripe'
import type { CreatorSignals, CampaignSignals, CampaignForCreator } from '@/lib/recommend'

// ── DB row → ranking signal mappers (server-only) ───────────────────────────
// Keeps every surface assembling CreatorSignals / CampaignSignals the same way,
// so ranking, labels, and the "self-reported vs verified" honesty are uniform.

export interface CreatorRow {
  id: string
  niche?: string | null
  niche_tags?: string[] | null
  average_rate_sgd?: number | null
  base_rate?: number | null
  availability_status?: string | null
  collabs_completed?: number | null
  rating_avg?: number | null
  rating_count?: number | null
  boost_active_until?: string | null
}

export interface SocialRow {
  follower_count?: number | null
  verification_status?: string | null
}

export interface ScoreRow {
  quality_score?: number | null
  reliability_score?: number | null
  response_rate_shrunk?: number | null
  response_rate?: number | null
  invites_concluded?: number | null
  verification_tier?: number | null
}

/** Best self-reported follower count across a creator's socials. */
export function followerCount(socials: SocialRow[]): number {
  return bestFollowers(socials as { follower_count: number | null }[])
}

/** True when ≥1 social has verified OWNERSHIP (never implies reach). */
export function hasVerifiedOwnership(socials: SocialRow[]): boolean {
  return socials.some(s => s.verification_status === 'verified')
}

export function toCreatorSignals(creator: CreatorRow, socials: SocialRow[], score?: ScoreRow | null): CreatorSignals {
  const niches = [creator.niche, ...((creator.niche_tags as string[] | null) ?? [])]
    .filter((n): n is string => Boolean(n))
  const avail = (creator.availability_status as CreatorSignals['availability']) || 'available'
  return {
    id: creator.id,
    niches: niches.length ? niches : [],
    followers: followerCount(socials),
    rate: creator.average_rate_sgd ?? creator.base_rate ?? null,
    availability: ['available', 'limited', 'unavailable'].includes(avail) ? avail : 'available',
    verifiedOwnership: hasVerifiedOwnership(socials),
    completedCollabs: creator.collabs_completed ?? 0,
    ratingAvg: Number(creator.rating_avg ?? 0),
    ratingCount: creator.rating_count ?? 0,
    qualityScore: score?.quality_score ?? null,
    reliabilityScore: score?.reliability_score ?? null,
    responseShrunk: score?.response_rate_shrunk != null ? Number(score.response_rate_shrunk) : null,
    responseSample: score?.invites_concluded ?? 0,
    // Boost only influences ranking when the paid feature is configured.
    boostedUntil: boostEnabled() ? (creator.boost_active_until ?? null) : null,
  }
}

export interface CampaignRow {
  id?: string
  niche_tags?: string[] | null
  min_followers?: number | null
  budget_min?: number | null
  budget_max?: number | null
  comp_type?: string | null
  created_at?: string
}

export function toCampaignSignals(c: CampaignRow): CampaignSignals {
  return {
    id: c.id,
    niches: (c.niche_tags as string[] | null) ?? [],
    minFollowers: c.min_followers ?? 0,
    budgetMin: c.budget_min ?? null,
    budgetMax: c.budget_max ?? null,
    compType: (['paid', 'barter', 'both'].includes(c.comp_type as string) ? c.comp_type : 'paid') as CampaignSignals['compType'],
  }
}

export function toCampaignForCreator(c: CampaignRow & { is_featured?: boolean | null }, brandCompletedCampaigns: number): CampaignForCreator {
  return {
    id: c.id as string,
    niches: (c.niche_tags as string[] | null) ?? [],
    minFollowers: c.min_followers ?? 0,
    budgetMin: c.budget_min ?? null,
    budgetMax: c.budget_max ?? null,
    compType: (['paid', 'barter', 'both'].includes(c.comp_type as string) ? c.comp_type : 'paid') as CampaignForCreator['compType'],
    createdAt: c.created_at ?? new Date().toISOString(),
    brandCompletedCampaigns,
    isFeatured: Boolean(c.is_featured),
  }
}

/** Verified-ownership tier label for badges (never implies follower verification). */
export const VERIFICATION_NOTE = 'Account ownership verified — follower counts are self-reported'
