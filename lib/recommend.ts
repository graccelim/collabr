import { nicheOverlap, nicheLabel } from '@/lib/niches'

// ── Two-sided recommendation engine (Discovery Foundation) ──────────────────
// Pure, deterministic, testable. Produces an internal ranking score (used only
// to ORDER results) and HONEST, categorical labels + reasons for the UI.
//
// Hard rule: never expose a numeric score (no "95% Match", "92 Reliability").
// The UI shows tiers (Best Match / Strong Fit / Good Fit), boolean indicators
// (Fits Your Budget, Available), and reasons - nothing else.

export type Availability = 'available' | 'limited' | 'unavailable'
export type CompType = 'paid' | 'barter' | 'both'

export interface CreatorSignals {
  id: string
  /** Canonical niche slugs (normalize before passing). */
  niches: string[]
  /** Best self-reported follower count (labelled "self-reported" in the UI). */
  followers: number
  /** Current rate in cents (average_rate_sgd → base_rate), or null = negotiable. */
  rate: number | null
  availability: Availability
  completedCollabs: number
  ratingAvg: number   // 0..5
  ratingCount: number
  // Internal score inputs (from creator_scores; never displayed).
  qualityScore?: number | null      // 0..100
  reliabilityScore?: number | null  // 0..100
  responseShrunk?: number | null    // 0..1
  responseSample?: number           // concluded invites
  boostedUntil?: string | null
}

export interface CampaignSignals {
  id?: string
  niches: string[]
  minFollowers: number
  budgetMin: number | null
  budgetMax: number | null
  compType: CompType
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Pull a thin-data signal toward neutral (0.5) by sample size. */
export function confidence(x: number, n: number, alpha: number): number {
  const w = n / (n + alpha)
  return x * w + 0.5 * (1 - w)
}

export interface BudgetFit {
  /** True when the creator's rate is within / under the campaign budget (or negotiable). */
  fits: boolean
  /** 0..1 factor for ranking. */
  factor: number
}

export function budgetFit(rate: number | null, min: number | null, max: number | null): BudgetFit {
  if (rate == null) return { fits: true, factor: 0.7 }          // negotiable
  if (max == null) return { fits: true, factor: 0.8 }            // no ceiling stated
  if (rate <= max) {
    // Comfortably within (or under) budget.
    if (min != null && rate < min * 0.5) return { fits: true, factor: 0.85 }
    return { fits: true, factor: 1 }
  }
  // Above the ceiling - fades the further over they are.
  return { fits: false, factor: clamp01(max / rate) * 0.6 }
}

export type MatchTier = 'best' | 'strong' | 'good' | 'none'

const TIER_LABEL: Record<MatchTier, string | null> = {
  best: 'Best Match',
  strong: 'Strong Fit',
  good: 'Good Fit',
  none: null,
}

export interface MatchResult {
  /** Internal 0..1 - for ordering only, never shown. */
  score: number
  tier: MatchTier
  /** Public label, or null when there isn't a credible fit to claim. */
  label: string | null
  /** Honest, brand-facing reasons (✓ chips). */
  reasons: string[]
}

const AVAIL_FACTOR: Record<Availability, number> = { available: 1, limited: 0.6, unavailable: 0.2 }

/** Creator ↔ campaign match. Score orders results; tier/label/reasons are shown. */
export function computeMatch(creator: CreatorSignals, campaign: CampaignSignals): MatchResult {
  const niche = nicheOverlap(creator.niches, campaign.niches)
  // Reach is self-reported (labelled as such in the UI); we don't verify it.
  const reach = campaign.minFollowers > 0 ? clamp01(creator.followers / campaign.minFollowers) : 1
  const bf = budgetFit(creator.rate, campaign.budgetMin, campaign.budgetMax)
  const avail = AVAIL_FACTOR[creator.availability]
  const qualityNorm = (creator.qualityScore ?? 50) / 100

  const score = clamp01(
    0.40 * niche +
    0.25 * reach +
    0.20 * bf.factor +
    0.10 * avail +
    0.05 * qualityNorm,
  )

  // Tier requires a real niche signal to avoid overclaiming a "Best Match" that
  // is only riding budget/availability.
  let tier: MatchTier = 'none'
  if (niche > 0) {
    if (score >= 0.82 && niche >= 0.5) tier = 'best'
    else if (score >= 0.66) tier = 'strong'
    else if (score >= 0.48) tier = 'good'
  }

  const reasons: string[] = []
  if (niche > 0) reasons.push('Same niche as your campaign')
  if (bf.fits && (creator.rate != null || campaign.budgetMax != null)) reasons.push('Fits your budget')
  if (creator.availability === 'available') reasons.push('Available for collaborations')
  if (creator.completedCollabs > 0) {
    reasons.push(`Completed ${creator.completedCollabs} collaboration${creator.completedCollabs > 1 ? 's' : ''}`)
  }

  return { score, tier, label: TIER_LABEL[tier], reasons }
}

// ── Internal ranking (orders lists; never displayed) ────────────────────────
function activeBoost(boostedUntil?: string | null, now: number = Date.parse('2026-06-14T00:00:00Z')): boolean {
  // `now` injectable for tests; callers pass Date.now().
  return Boolean(boostedUntil && Date.parse(boostedUntil) > now)
}

/** Bounded, labelled paid bump - additive, never blended into trust signals. */
export const BOOST_BUMP = 0.06

export interface RankedCreator {
  creator: CreatorSignals
  match: MatchResult
  rankScore: number
  boosted: boolean
}

/**
 * Rank creators for discovery. With a campaign context, match dominates; without
 * one, fall back to quality + responsiveness + reliability. Paid boost is a
 * small, separate additive bump (and surfaced as a "Boosted" label by the UI).
 */
export function rankCreators(
  creators: CreatorSignals[],
  campaign: CampaignSignals | null,
  now: number = Date.now(),
): RankedCreator[] {
  return creators
    .map(c => {
      const match = campaign
        ? computeMatch(c, campaign)
        : { score: 0, tier: 'none' as MatchTier, label: null, reasons: [] as string[] }
      const qualityNorm = (c.qualityScore ?? 50) / 100
      const reliabilityNorm = (c.reliabilityScore ?? 50) / 100
      const respNorm = confidence(c.responseShrunk ?? 0.5, c.responseSample ?? 0, 5)
      const qConf = confidence(qualityNorm, c.completedCollabs, 3)

      const merit = campaign
        ? 0.50 * match.score + 0.30 * qConf + 0.20 * respNorm
        : 0.55 * qConf + 0.25 * respNorm + 0.20 * reliabilityNorm

      const boosted = activeBoost(c.boostedUntil, now)
      const rankScore = clamp01(merit) + (boosted ? BOOST_BUMP : 0)
      return { creator: c, match, rankScore, boosted }
    })
    .sort((a, b) => b.rankScore - a.rankScore)
}

// ── Creator-facing campaign recommendations ─────────────────────────────────
export interface CampaignForCreator {
  id: string
  niches: string[]
  minFollowers: number
  budgetMin: number | null
  budgetMax: number | null
  compType: CompType
  createdAt: string
  /** Owning brand's completed-campaign count (active-brand signal). */
  brandCompletedCampaigns: number
  isFeatured?: boolean
}

export interface RankedCampaign {
  campaign: CampaignForCreator
  score: number
  tier: MatchTier
  label: string | null
  reasons: string[]
  featured: boolean
}

/** Recency decay over ~30 days. */
function freshness(createdAt: string, now: number): number {
  const ageDays = (now - Date.parse(createdAt)) / 86_400_000
  return clamp01(1 - ageDays / 30)
}

/**
 * Rank campaigns for a creator. Same engine, other direction. Reasons are
 * creator-facing. Featured campaigns get a bounded, labelled bump only.
 */
export function rankCampaignsForCreator(
  creator: CreatorSignals,
  campaigns: CampaignForCreator[],
  now: number = Date.now(),
): RankedCampaign[] {
  return campaigns
    .map(cam => {
      const m = computeMatch(creator, cam)
      const budgetAttractive = creator.rate != null && cam.budgetMax != null
        ? clamp01(cam.budgetMax / Math.max(creator.rate, 1))
        : 0.6
      const fresh = freshness(cam.createdAt, now)
      const activeBrand = cam.brandCompletedCampaigns > 0 ? 1 : 0.5

      const base = 0.55 * m.score + 0.20 * budgetAttractive + 0.15 * fresh + 0.10 * activeBrand
      const featured = Boolean(cam.isFeatured)
      const score = clamp01(base) + (featured ? BOOST_BUMP : 0)

      const reasons: string[] = []
      if (nicheOverlap(creator.niches, cam.niches) > 0) reasons.push('Matches your niche')
      const bf = budgetFit(creator.rate, cam.budgetMin, cam.budgetMax)
      if (bf.fits && creator.rate != null) reasons.push('Fits your usual rates')
      if (cam.brandCompletedCampaigns > 0) reasons.push('Active brand')

      return { campaign: cam, score, tier: m.tier, label: m.label, reasons, featured }
    })
    .sort((a, b) => b.score - a.score)
}

// ── Honest creator-card indicators (UI helper, no numbers) ──────────────────
export interface CreatorIndicators {
  fitsBudget: boolean            // → "Fits Your Budget" (campaign context only)
  available: boolean             // → "Available Now"
  isNew: boolean                 // no completed collabs → "New Creator"
  completedCollabs: number       // → "N Completed Collaborations"
  /** Show ratings only with a real sample. */
  showRating: boolean
}

export function creatorIndicators(c: CreatorSignals, campaign: CampaignSignals | null): CreatorIndicators {
  const bf = campaign ? budgetFit(c.rate, campaign.budgetMin, campaign.budgetMax) : { fits: false, factor: 0 }
  return {
    fitsBudget: Boolean(campaign) && bf.fits,
    available: c.availability === 'available',
    isNew: c.completedCollabs === 0,
    completedCollabs: c.completedCollabs,
    showRating: c.ratingCount >= 1,
  }
}

// ── Honest responsiveness standing (UI helper, NEVER a number) ──────────────
// Mirrors the recompute rule: a response rate is only meaningful at ≥3 concluded
// invites. Below that we say so plainly; above it we summarise categorically.
// We never expose response_rate as a percentage.
export function responseStanding(
  sample: number | null | undefined,
  shrunk: number | null | undefined,
): { hasHistory: boolean; label: string } {
  if ((sample ?? 0) < 3) return { hasHistory: false, label: 'Not enough response history yet' }
  return { hasHistory: true, label: (shrunk ?? 0) >= 0.66 ? 'Usually responds to invites' : 'Responds to invites occasionally' }
}

export { nicheLabel }
