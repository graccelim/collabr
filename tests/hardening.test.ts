import { describe, it, expect } from 'vitest'
import {
  rankCreators, creatorIndicators, responseStanding, BOOST_BUMP,
  type CreatorSignals, type CampaignSignals,
} from '@/lib/recommend'
import { normalizeNicheTags } from '@/lib/niches'
import { creatorProfileUpdateSchema } from '@/lib/profiles'
import { creatorOnboardingSchema } from '@/lib/onboarding'

// Note: we deliberately do NOT import lib/discovery-data or lib/stripe here -
// lib/stripe instantiates the Stripe SDK at module load (needs a live key). The
// boost-gating those modules apply is exercised at the data layer in the app;
// here we test the pure ranking guarantees that protect against payment abuse.

const creator = (o: Partial<CreatorSignals> = {}): CreatorSignals => ({
  id: 'c', niches: ['food'], followers: 10000, rate: 20000, availability: 'available',
  completedCollabs: 3, ratingAvg: 4.5, ratingCount: 3,
  qualityScore: 70, reliabilityScore: 60, responseShrunk: 0.5, responseSample: 3, ...o,
})
const campaign = (o: Partial<CampaignSignals> = {}): CampaignSignals => ({
  niches: ['food'], minFollowers: 5000, budgetMin: 10000, budgetMax: 50000, compType: 'paid', ...o,
})

const NOW = Date.parse('2026-06-14T00:00:00Z')
const FUTURE = '2026-07-01T00:00:00Z'
const PAST = '2026-01-01T00:00:00Z'

// ── Boost: paid placement only, and only a bounded, separate bump ────────────
describe('boost ranking is bounded and never inflates merit/trust', () => {
  it('adds exactly BOOST_BUMP and leaves the underlying match/merit untouched', () => {
    const plain = creator({ id: 'plain' })
    const boosted = creator({ id: 'boosted', boostedUntil: FUTURE })
    const [ranked] = rankCreators([boosted], campaign(), NOW)
    const [unranked] = rankCreators([plain], campaign(), NOW)
    // Same match quality - boost is additive on top, not part of the match.
    expect(ranked.match.score).toBeCloseTo(unranked.match.score)
    expect(ranked.match.tier).toBe(unranked.match.tier)
    expect(ranked.rankScore - unranked.rankScore).toBeCloseTo(BOOST_BUMP)
    expect(ranked.boosted).toBe(true)
  })

  it('the bump is small - it cannot flip a weak match into a strong one', () => {
    // A boosted off-niche creator must not outrank a great on-niche match.
    const offNicheBoosted = creator({ id: 'paid', niches: ['gaming'], qualityScore: 30, boostedUntil: FUTURE })
    const onNicheStrong = creator({ id: 'merit', niches: ['food'], qualityScore: 90 })
    const ranked = rankCreators([offNicheBoosted, onNicheStrong], campaign(), NOW)
    expect(ranked[0].creator.id).toBe('merit')
  })

  it('boost never changes the match label (no "Best Match" bought with money)', () => {
    const boosted = creator({ id: 'b', niches: ['gaming'], boostedUntil: FUTURE })
    const [r] = rankCreators([boosted], campaign(), NOW)
    // Label comes purely from match quality; an off-niche creator stays unlabelled.
    expect(r.match.label === null || !/best match/i.test(r.match.label)).toBe(true)
  })
})

// ── Boost disabled / expired = no bump (mirrors hidden-feature behaviour) ─────
describe('boost only counts while active', () => {
  it('no boostedUntil → no bump (feature disabled path nulls this out)', () => {
    const [r] = rankCreators([creator({ boostedUntil: null })], campaign(), NOW)
    expect(r.boosted).toBe(false)
  })
  it('expired boost → no bump', () => {
    const [r] = rankCreators([creator({ boostedUntil: PAST })], campaign(), NOW)
    expect(r.boosted).toBe(false)
  })
})

// ── Niche cap: genuine multi-niche, never category spam ──────────────────────
describe('niche_tags are capped at 4', () => {
  it('profile update rejects more than 4 niches', () => {
    const ok = creatorProfileUpdateSchema.safeParse({ niche_tags: ['food', 'beauty', 'tech', 'fitness'] })
    expect(ok.success).toBe(true)
    const tooMany = creatorProfileUpdateSchema.safeParse({
      niche_tags: ['food', 'beauty', 'tech', 'fitness', 'travel'],
    })
    expect(tooMany.success).toBe(false)
  })
  it('onboarding niche is OPTIONAL (0 ok) but capped at four; a social is required', () => {
    const socials = [{ platform: 'instagram', handle: 'x', follower_count: 100 }]
    // Niche optional now — empty is allowed (added later from the checklist).
    expect(creatorOnboardingSchema.safeParse({ niche_tags: [], socials }).success).toBe(true)
    expect(creatorOnboardingSchema.safeParse({ socials }).success).toBe(true) // omitted entirely
    expect(creatorOnboardingSchema.safeParse({ niche_tags: ['food'], socials }).success).toBe(true)
    // Still capped at 4.
    expect(creatorOnboardingSchema.safeParse({
      niche_tags: ['food', 'beauty', 'tech', 'fitness', 'travel'], socials,
    }).success).toBe(false)
    // A social profile is still required.
    expect(creatorOnboardingSchema.safeParse({ niche_tags: ['food'], socials: [] }).success).toBe(false)
  })
  it('normalizeNicheTags still dedupes and canonicalizes (multi-niche preserved)', () => {
    expect(normalizeNicheTags(['Food', 'cafe', 'Beauty']).sort()).toEqual(['beauty', 'food'])
  })
})

// ── Response standing is categorical, never a number ─────────────────────────
describe('responseStanding (new creators + honest fallback)', () => {
  it('a creator with no invite history shows the honest fallback copy', () => {
    const r = responseStanding(0, null)
    expect(r.hasHistory).toBe(false)
    expect(r.label).toBe('Not enough response history yet')
    // below the 3-invite threshold, still no claim
    expect(responseStanding(2, 0.9).label).toBe('Not enough response history yet')
  })
  it('with enough history it returns a categorical label, never a percentage', () => {
    const high = responseStanding(5, 0.8)
    const low = responseStanding(5, 0.2)
    expect(high.hasHistory).toBe(true)
    expect(high.label).toBe('Usually responds to invites')
    expect(low.label).toBe('Responds to invites occasionally')
    for (const l of [high.label, low.label]) expect(l).not.toMatch(/\d/) // no digits
  })
})

// ── No social-ownership verification concept in beta ─────────────────────────
describe('creator indicators never claim social-account verification', () => {
  it('exposes only honest, earned indicators (no "verified" field)', () => {
    const ind = creatorIndicators(creator({ completedCollabs: 5, ratingCount: 4 }), campaign())
    expect('verified' in ind).toBe(false)
    expect(ind.available).toBe(true)
    expect(ind.completedCollabs).toBe(5)
  })
})
