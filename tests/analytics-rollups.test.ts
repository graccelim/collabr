import { describe, it, expect } from 'vitest'
import { computeCreatorRollup, computeCampaignRollup, type RollupPost } from '@/lib/analytics/rollups'

function post(p: Partial<RollupPost>): RollupPost {
  return { platform: 'tiktok', views: null, likes: null, comments: null, shares: null, saves: null, reach: null, postedAt: null, ...p }
}

describe('computeCreatorRollup', () => {
  it('sums totals and averages from the creator’s own posts', () => {
    const r = computeCreatorRollup([
      post({ platform: 'tiktok', views: 100, likes: 10 }),
      post({ platform: 'tiktok', views: 300, likes: 30 }),
      post({ platform: 'instagram', views: 200, likes: 20 }),
    ])
    expect(r.totals.views).toBe(600)
    expect(r.totals.likes).toBe(60)
    expect(r.averages.views).toBe(200)
    expect(r.averages.engagementRate).toBeCloseTo(0.1, 5)
    expect(r.byPlatform.tiktok.posts).toBe(2)
    expect(r.byPlatform.instagram.totals.views).toBe(200)
  })

  it('engagement rate is null with no denominator (no fabrication)', () => {
    const r = computeCreatorRollup([post({ likes: 5 }), post({ likes: 9 })])
    expect(r.averages.engagementRate).toBeNull()
    expect(r.averages.views).toBeNull()
  })

  it('empty input is safe', () => {
    const r = computeCreatorRollup([])
    expect(r.posts).toBe(0)
    expect(r.totals.views).toBe(0)
    expect(r.bestPosts).toEqual([])
  })
})

describe('computeCampaignRollup (brand’s own campaign only)', () => {
  it('computes totals, CPV and CPE in cents', () => {
    const r = computeCampaignRollup([
      { creatorId: 'a', handle: '@a', payoutCents: 10000, posts: [post({ views: 1000, likes: 100 })] },
      { creatorId: 'b', handle: '@b', payoutCents: 5000, posts: [post({ views: 1000, likes: 50 })] },
    ])
    expect(r.totals.views).toBe(2000)
    expect(r.totals.spendCents).toBe(15000)
    expect(r.totals.engagement).toBe(150)
    // CPV = 15000 cents / 2000 views = 7.5 cents/view
    expect(r.derived.cpvCents).toBeCloseTo(7.5, 5)
    // CPE = 15000 / 150 = 100 cents/engagement
    expect(r.derived.cpeCents).toBeCloseTo(100, 5)
    // Engagement rate = 150 / 2000 = 0.075
    expect(r.derived.engagementRate).toBeCloseTo(0.075, 5)
    expect(r.perCreator).toHaveLength(2)
    expect(r.topPost?.interactions).toBe(100)
  })

  it('avoids divide-by-zero (no views/engagement → null)', () => {
    const r = computeCampaignRollup([{ creatorId: 'a', payoutCents: 5000, posts: [] }])
    expect(r.derived.cpvCents).toBeNull()
    expect(r.derived.cpeCents).toBeNull()
    expect(r.topPost).toBeNull()
  })

  it('output carries no score/percentile/rank fields', () => {
    const r = computeCampaignRollup([{ creatorId: 'a', payoutCents: 1, posts: [post({ views: 1 })] }])
    expect(JSON.stringify(r).toLowerCase()).not.toMatch(/score|percentile|"rank"/)
  })
})
