import { describe, it, expect } from 'vitest'
import { normalizeNiche, normalizeNicheTags, nicheOverlap, NICHE_SLUGS } from '@/lib/niches'
import {
  computeMatch, budgetFit, rankCreators, rankCampaignsForCreator, creatorIndicators,
  confidence, type CreatorSignals, type CampaignSignals, type CampaignForCreator,
} from '@/lib/recommend'

// ── Part 1: niche normalization ─────────────────────────────────────────────
describe('niche normalization', () => {
  it('folds the F&B family onto a single canonical slug', () => {
    for (const v of ['Food', 'F&B', 'Food & Beverage', 'food and beverage', 'fnb', 'Restaurant', 'cafe', 'COFFEE']) {
      expect(normalizeNiche(v)).toBe('food')
    }
  })
  it('maps common synonyms across niches', () => {
    expect(normalizeNiche('skincare')).toBe('beauty')
    expect(normalizeNiche('technology')).toBe('tech')
    expect(normalizeNiche('hospitality')).toBe('travel')
    expect(normalizeNiche('finance')).toBe('business')
    expect(normalizeNiche('esports')).toBe('gaming')
  })
  it('passes through canonical slugs and returns null for the unmappable', () => {
    for (const s of NICHE_SLUGS) expect(normalizeNiche(s)).toBe(s)
    expect(normalizeNiche('quantum-basket-weaving')).toBeNull()
    expect(normalizeNiche('')).toBeNull()
    expect(normalizeNiche(null)).toBeNull()
  })
  it('dedupes a tag list to canonical slugs', () => {
    expect(normalizeNicheTags(['F&B', 'cafe', 'beauty', 'skincare', 'nonsense']).sort())
      .toEqual(['beauty', 'food'])
  })
  it('Jaccard overlap: matched vs unmatched vs untargeted', () => {
    expect(nicheOverlap(['food'], ['F&B'])).toBe(1)            // same after normalization
    expect(nicheOverlap(['food'], ['beauty'])).toBe(0)
    expect(nicheOverlap(['food'], [])).toBe(1)                  // untargeted campaign
    expect(nicheOverlap([], ['food'])).toBe(0)
    expect(nicheOverlap(['food', 'beauty'], ['food'])).toBeCloseTo(0.5)
  })
})

// ── Helpers ─────────────────────────────────────────────────────────────────
const baseCreator = (o: Partial<CreatorSignals> = {}): CreatorSignals => ({
  id: 'c', niches: ['food'], followers: 10000, rate: 20000, availability: 'available',
  completedCollabs: 0, ratingAvg: 0, ratingCount: 0, ...o,
})
const campaign = (o: Partial<CampaignSignals> = {}): CampaignSignals => ({
  niches: ['food'], minFollowers: 5000, budgetMin: 10000, budgetMax: 50000, compType: 'paid', ...o,
})

// ── budget fit ──────────────────────────────────────────────────────────────
describe('budgetFit', () => {
  it('within / under / over / negotiable', () => {
    expect(budgetFit(20000, 10000, 50000).fits).toBe(true)
    expect(budgetFit(60000, 10000, 50000).fits).toBe(false)
    expect(budgetFit(null, 10000, 50000).fits).toBe(true)       // negotiable
    expect(budgetFit(20000, null, null).fits).toBe(true)
  })
})

// ── match + honest labels ───────────────────────────────────────────────────
describe('computeMatch', () => {
  it('a same-niche, in-budget, available creator earns a fit tier and honest reasons', () => {
    const m = computeMatch(baseCreator({ completedCollabs: 3 }), campaign())
    expect(['best', 'strong', 'good']).toContain(m.tier)
    expect(m.label).toMatch(/Match|Fit/)
    expect(m.reasons).toContain('Same niche as your campaign')
    expect(m.reasons).toContain('Fits your budget')
    expect(m.reasons).toContain('Available for collaborations')
    expect(m.reasons.some(r => /Completed 3 collaboration/.test(r))).toBe(true)
    // never claims social-ownership verification (beta has no such concept)
    expect(m.reasons.some(r => /verif/i.test(r))).toBe(false)
    // never a raw percentage
    expect(JSON.stringify(m)).not.toMatch(/%/)
  })

  it('does NOT claim a fit tier when there is no niche overlap (no overclaim)', () => {
    const m = computeMatch(baseCreator({ niches: ['gaming'] }), campaign({ niches: ['food'] }))
    expect(m.tier).toBe('none')
    expect(m.label).toBeNull()
    expect(m.reasons).not.toContain('Same niche as your campaign')
  })
})

// ── ranking ─────────────────────────────────────────────────────────────────
describe('rankCreators', () => {
  it('orders by merit and applies a bounded, separate boost bump', () => {
    const strong = baseCreator({ id: 'strong', completedCollabs: 8, ratingCount: 6, qualityScore: 90 })
    const weak = baseCreator({ id: 'weak', niches: ['gaming'], completedCollabs: 0, qualityScore: 40 })
    const ranked = rankCreators([weak, strong], campaign())
    expect(ranked[0].creator.id).toBe('strong')

    // boost is additive and small - it lifts a tie but cannot invent quality
    const boosted = baseCreator({ id: 'boosted', boostedUntil: '2999-01-01T00:00:00Z' })
    const plain = baseCreator({ id: 'plain' })
    const r2 = rankCreators([plain, boosted], campaign(), Date.parse('2026-06-14T00:00:00Z'))
    expect(r2[0].creator.id).toBe('boosted')
    expect(r2.find(r => r.creator.id === 'boosted')!.boosted).toBe(true)
  })

  it('without a campaign context falls back to quality/response/reliability', () => {
    const ranked = rankCreators([baseCreator()], null)
    expect(ranked[0].match.tier).toBe('none')   // no fake campaign match
    expect(ranked[0].rankScore).toBeGreaterThan(0)
  })
})

describe('confidence shrinkage', () => {
  it('pulls thin-data scores toward neutral', () => {
    expect(confidence(1, 0, 5)).toBeCloseTo(0.5)     // no data → neutral
    expect(confidence(1, 95, 5)).toBeCloseTo(0.975)  // lots of data → near raw
    expect(confidence(1, 95, 5)).toBeGreaterThan(0.95)
  })
})

// ── creator-facing campaign recommendations ─────────────────────────────────
describe('rankCampaignsForCreator', () => {
  it('ranks on-niche, in-budget, fresh campaigns higher and gives honest reasons', () => {
    const creator = baseCreator({ rate: 20000 })
    const good: CampaignForCreator = {
      id: 'good', niches: ['food'], minFollowers: 1000, budgetMin: 10000, budgetMax: 40000,
      compType: 'paid', createdAt: new Date().toISOString(), brandCompletedCampaigns: 3,
    }
    const poor: CampaignForCreator = {
      id: 'poor', niches: ['gaming'], minFollowers: 1000, budgetMin: 100, budgetMax: 500,
      compType: 'paid', createdAt: '2020-01-01T00:00:00Z', brandCompletedCampaigns: 0,
    }
    const ranked = rankCampaignsForCreator(creator, [poor, good])
    expect(ranked[0].campaign.id).toBe('good')
    expect(ranked[0].reasons).toContain('Matches your niche')
    expect(ranked[0].reasons).toContain('Active brand')
    expect(JSON.stringify(ranked)).not.toMatch(/%/)
  })
})

// ── honest fallback indicators ──────────────────────────────────────────────
describe('creatorIndicators (fallback labels)', () => {
  it('flags a new creator and hides rating when there is no history', () => {
    const ind = creatorIndicators(baseCreator({ completedCollabs: 0, ratingCount: 0 }), campaign())
    expect(ind.isNew).toBe(true)                 // → "New Creator"
    expect(ind.showRating).toBe(false)           // no fabricated rating
    expect(ind.available).toBe(true)
  })
  it('shows experience for an established creator', () => {
    const ind = creatorIndicators(baseCreator({ completedCollabs: 5, ratingCount: 4 }), campaign())
    expect(ind.isNew).toBe(false)
    expect(ind.completedCollabs).toBe(5)
    expect(ind.showRating).toBe(true)
    expect(ind.fitsBudget).toBe(true)
  })
})
