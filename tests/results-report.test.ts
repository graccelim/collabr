import { describe, it, expect } from 'vitest'
import { aggregateResults, reportingRate, sharesResults, collabResultSchema, type ResultRow } from '@/lib/results/report'

const row = (p: Partial<ResultRow>): ResultRow => ({ views: null, likes: null, comments: null, shares: null, saves: null, reach: null, ...p })
const day = 86_400_000

describe('aggregateResults', () => {
  it('sums present metrics and computes engagement + rate', () => {
    const r = aggregateResults([
      row({ views: 1000, likes: 100, comments: 10, shares: 5, saves: 5, reach: 800 }),
      row({ views: 2000, likes: 200, comments: 20, shares: 5, saves: 5, reach: 1500 }),
    ])
    expect(r.reportedCount).toBe(2)
    expect(r.views).toBe(3000)
    expect(r.engagement).toBe(100 + 10 + 5 + 5 + 200 + 20 + 5 + 5) // 350
    expect(r.engagementRate).toBeCloseTo(350 / 3000, 5)
  })

  it('leaves a metric null when NO row reported it (never a fake 0)', () => {
    const r = aggregateResults([row({ views: 500 }), row({ views: 700 })])
    expect(r.views).toBe(1200)
    expect(r.likes).toBeNull()
    expect(r.reach).toBeNull()
    expect(r.engagement).toBeNull()
    expect(r.engagementRate).toBeNull()
  })

  it('sums partially-present metrics across rows', () => {
    const r = aggregateResults([row({ views: 100, likes: 10 }), row({ views: 200 })])
    expect(r.views).toBe(300)
    expect(r.likes).toBe(10) // only one row reported likes
  })

  it('is null-safe on empty input', () => {
    const r = aggregateResults([])
    expect(r.reportedCount).toBe(0)
    expect(r.views).toBeNull()
    expect(r.engagementRate).toBeNull()
  })

  it('no engagement rate when views are zero', () => {
    const r = aggregateResults([row({ views: 0, likes: 50 })])
    expect(r.engagement).toBe(50)
    expect(r.engagementRate).toBeNull()
  })
})

describe('reportingRate', () => {
  const now = new Date('2026-07-01T00:00:00Z')
  it('counts only collabs past the grace window; recent ones do not count against you', () => {
    const r = reportingRate([
      { completedAt: new Date(now.getTime() - 30 * day), reportedAt: new Date() }, // eligible + reported
      { completedAt: new Date(now.getTime() - 20 * day), reportedAt: null },        // eligible + not
      { completedAt: new Date(now.getTime() - 3 * day), reportedAt: null },         // too recent → ignored
    ], now, 14)
    expect(r.eligible).toBe(2)
    expect(r.reported).toBe(1)
    expect(r.rate).toBe(0.5)
  })

  it('rate is null when nothing is due yet', () => {
    const r = reportingRate([{ completedAt: new Date(now.getTime() - 2 * day), reportedAt: null }], now, 14)
    expect(r.eligible).toBe(0)
    expect(r.rate).toBeNull()
  })

  it('ignores collabs with no completion date', () => {
    const r = reportingRate([{ completedAt: null, reportedAt: null }], now, 14)
    expect(r.eligible).toBe(0)
  })
})

describe('sharesResults badge', () => {
  it('true only with enough eligible + high rate', () => {
    expect(sharesResults({ eligible: 5, reported: 5, rate: 1 })).toBe(true)
    expect(sharesResults({ eligible: 5, reported: 4, rate: 0.8 })).toBe(true)
    expect(sharesResults({ eligible: 5, reported: 3, rate: 0.6 })).toBe(false) // rate too low
    expect(sharesResults({ eligible: 2, reported: 2, rate: 1 })).toBe(false)   // too few
    expect(sharesResults({ eligible: 0, reported: 0, rate: null })).toBe(false)
  })
})

describe('collabResultSchema', () => {
  it('accepts valid input with at least one metric + a url', () => {
    const r = collabResultSchema.safeParse({ views: 1000, post_url: 'https://tiktok.com/@x/video/1' })
    expect(r.success).toBe(true)
  })
  it('rejects when no metric is provided', () => {
    const r = collabResultSchema.safeParse({ post_url: 'https://x.com/p/1' })
    expect(r.success).toBe(false)
  })
  it('rejects a bad url', () => {
    const r = collabResultSchema.safeParse({ views: 10, post_url: 'not-a-url' })
    expect(r.success).toBe(false)
  })
  it('rejects negative or non-integer metrics', () => {
    expect(collabResultSchema.safeParse({ views: -5, post_url: 'https://a.com' }).success).toBe(false)
    expect(collabResultSchema.safeParse({ views: 1.5, post_url: 'https://a.com' }).success).toBe(false)
  })
})
