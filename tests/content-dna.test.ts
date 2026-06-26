import { describe, it, expect } from 'vitest'
import { computeContentDna } from '@/lib/analytics/contentDna'
import type { NormalizedPost } from '@/lib/analytics/adapters/types'

function post(p: Partial<NormalizedPost>): NormalizedPost {
  return {
    externalId: Math.random().toString(36).slice(2),
    platform: 'tiktok',
    url: 'https://x',
    postedAt: null,
    views: null, likes: null, comments: null, shares: null, saves: null, reach: null,
    ...p,
  }
}

describe('computeContentDna — deterministic, self-only', () => {
  it('flags insufficient data with too few posts (never guesses)', () => {
    const dna = computeContentDna([post({ views: 100, likes: 10 })])
    expect(dna.confidence.overall).toBe('insufficient')
    expect(dna.confidence.categories).toBe('insufficient')
  })

  it('computes averages from the creator’s own posts', () => {
    const dna = computeContentDna([
      post({ views: 100, likes: 10, comments: 0, shares: 0, saves: 0 }),
      post({ views: 300, likes: 30, comments: 0, shares: 0, saves: 0 }),
      post({ views: 200, likes: 20, comments: 0, shares: 0, saves: 0 }),
    ])
    expect(dna.averages.views).toBe(200)
    // engagement rate = interactions/views = 0.1 for each → avg 0.1
    expect(dna.averages.engagementRate).toBeCloseTo(0.1, 5)
  })

  it('ranks the creator’s own categories by their own engagement (no comparison to others)', () => {
    const posts = [
      post({ category: 'restaurant', views: 100, likes: 40 }),
      post({ category: 'restaurant', views: 100, likes: 50 }),
      post({ category: 'restaurant', views: 100, likes: 45 }),
      post({ category: 'cafe', views: 100, likes: 5 }),
      post({ category: 'cafe', views: 100, likes: 6 }),
      post({ category: 'cafe', views: 100, likes: 7 }),
    ]
    const dna = computeContentDna(posts)
    expect(dna.confidence.categories).toBe('ok')
    expect(dna.bestCategories[0].key).toBe('restaurant')
    expect(dna.bestCategories[0].avgInteractions).toBeGreaterThan(dna.bestCategories[1].avgInteractions)
  })

  it('buckets posting times and video length deterministically', () => {
    const morning = new Date('2026-06-01T08:00:00Z') // Monday
    const evening = new Date('2026-06-01T20:00:00Z')
    const dna = computeContentDna([
      post({ postedAt: morning, durationSec: 10, views: 100, likes: 5 }),
      post({ postedAt: morning, durationSec: 12, views: 100, likes: 6 }),
      post({ postedAt: evening, durationSec: 90, views: 100, likes: 50 }),
    ])
    expect(dna.bestPostingDays[0].key).toBe('Mon')
    expect(dna.bestPostingTimes.map((g) => g.key)).toContain('Morning (6–12pm)')
    expect(dna.bestVideoLength).not.toBeNull()
  })

  it('computes posting consistency from real gaps', () => {
    const dna = computeContentDna([
      post({ postedAt: new Date('2026-06-01T00:00:00Z'), views: 100, likes: 1 }),
      post({ postedAt: new Date('2026-06-08T00:00:00Z'), views: 100, likes: 1 }),
      post({ postedAt: new Date('2026-06-15T00:00:00Z'), views: 100, likes: 1 }),
    ])
    expect(dna.postingConsistency?.postsPerWeek).toBeCloseTo(1.5, 1)
    expect(dna.postingConsistency?.gapStdDevDays).toBe(0) // even 7-day gaps
  })

  it('engagement rate is null when no denominator (no views/reach) — no fabrication', () => {
    const dna = computeContentDna([
      post({ likes: 10 }), post({ likes: 20 }), post({ likes: 30 }),
    ])
    expect(dna.averages.engagementRate).toBeNull()
    expect(dna.averages.views).toBeNull()
  })

  it('output has no score/percentile/rank fields', () => {
    const dna = computeContentDna([post({ views: 100, likes: 10 })])
    expect(JSON.stringify(dna).toLowerCase()).not.toMatch(/score|percentile|"rank"/)
  })
})
