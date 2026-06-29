import { describe, it, expect } from 'vitest'
import { computePlatformInsights, type InsightPost } from '@/lib/analytics/insights'

function post(p: Partial<InsightPost>): InsightPost {
  return { postedAt: null, durationSec: null, category: null, subcategory: null, style: null, format: null, views: 1000, likes: 0, comments: 0, shares: 0, saves: 0, reach: null, ...p }
}

describe('computePlatformInsights', () => {
  it('is per-platform and never throws on empty data', () => {
    const r = computePlatformInsights('tiktok', [])
    expect(r.platform).toBe('tiktok')
    expect(r.postCount).toBe(0)
    expect(r.dataConfidence).toBe('low')
    expect(r.insights).toEqual([])
  })

  it('surfaces a best-video-length pattern vs the creator’s own baseline', () => {
    const shorts = Array.from({ length: 8 }, () => post({ durationSec: 10, views: 1000, likes: 200 })) // 20% rate
    const longs = Array.from({ length: 8 }, () => post({ durationSec: 90, views: 1000, likes: 20 }))    // 2% rate
    // YouTube/Instagram have real video durations; TikTok's are gated (photo-mode ambiguity).
    const r = computePlatformInsights('youtube', [...shorts, ...longs])
    const len = r.insights.find((i) => i.key === 'best_length')
    expect(len).toBeTruthy()
    expect(len!.title).toMatch(/under 15s/i)
    expect(len!.confidence).toBe('medium') // 8 samples → medium
    expect(len!.evidence).toMatch(/%/)
  })

  it('computes a deterministic overview (median/avg) and engagement rate', () => {
    const posts = [post({ views: 100, likes: 10 }), post({ views: 200, likes: 20 }), post({ views: 300, likes: 30 })]
    const r = computePlatformInsights('youtube', posts)
    expect(r.overview.medianViews).toBe(200)
    expect(r.overview.avgViews).toBe(200)
    expect(r.overview.avgEngagementRate).toBeCloseTo(0.1, 5)
  })

  it('detects a long-term trend from snapshot history (memory native tools discard)', () => {
    const posts = Array.from({ length: 10 }, () => post({ durationSec: 20, views: 500, likes: 30 }))
    const trend = Array.from({ length: 20 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, views: 100 + i * 50 }))
    const r = computePlatformInsights('instagram', posts, trend)
    const t = r.insights.find((i) => i.key === 'trend')
    expect(t).toBeTruthy()
    expect(t!.title).toMatch(/climbing/i)
  })

  it('never fabricates: thin per-bucket data yields no length insight', () => {
    const r = computePlatformInsights('tiktok', [post({ durationSec: 10, views: 1000, likes: 200 })])
    expect(r.insights.find((i) => i.key === 'best_length')).toBeFalsy()
    expect(r.dataConfidence).toBe('low')
  })
})
