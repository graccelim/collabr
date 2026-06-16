// Derived "fit" score (Collabr Redesign): a real, explainable signal - NOT a
// fabricated metric. Fit is computed only from data the platform already
// stores: how well the creator's niche overlaps the campaign's target niches,
// and whether the creator meets the campaign's follower minimum.
//
// Engagement % and audience demographics from the prototype are deliberately
// NOT modelled here - they require platform-API / scraping data the app does
// not have, so we don't invent them.

export interface FitResult {
  /** 0–100 fit percentage. */
  pct: number
  /** Short human label for the pill. */
  label: string
  /** True when the creator's niche overlaps the campaign's target niches. */
  nicheMatch: boolean
  /** True when the creator clears the campaign's follower minimum. */
  followersMet: boolean
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Compute a creator↔campaign fit score.
 *
 * @param creator.niches  the creator's niche(s) - pass `niche` and/or `niches[]`
 * @param creator.followers  the creator's best/total follower count (0 if unknown)
 * @param campaign.niches  the campaign's target niche tags
 * @param campaign.minFollowers  the campaign's follower minimum (0 = none)
 */
export function computeFit(
  creator: { niches: (string | null | undefined)[]; followers: number },
  campaign: { niches: (string | null | undefined)[]; minFollowers: number },
): FitResult {
  const creatorNiches = new Set(creator.niches.filter(Boolean).map(n => norm(n as string)))
  const campaignNiches = campaign.niches.filter(Boolean).map(n => norm(n as string))

  const nicheMatch = campaignNiches.length === 0
    ? true // untargeted campaign - every creator is on-niche
    : campaignNiches.some(n => creatorNiches.has(n))

  const followersMet = campaign.minFollowers > 0
    ? creator.followers >= campaign.minFollowers
    : true
  // Partial credit when below the minimum so the score degrades gracefully.
  const followerScore = campaign.minFollowers > 0
    ? Math.min(1, creator.followers / campaign.minFollowers)
    : 1

  // 70% niche, 30% reach. Floored at 45 so a real candidate never reads "0%".
  const raw = 0.7 * (nicheMatch ? 1 : 0.25) + 0.3 * followerScore
  const pct = Math.max(45, Math.min(99, Math.round(raw * 100)))

  const label = pct >= 85 ? 'Strong fit' : pct >= 65 ? 'Good fit' : 'Possible fit'

  return { pct, label, nicheMatch, followersMet }
}

/** Best follower count from a creator's social accounts (0 if none). */
export function bestFollowers(socials: { follower_count: number | null }[]): number {
  return socials.reduce((max, s) => Math.max(max, s.follower_count || 0), 0)
}
