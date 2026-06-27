// Deterministic rollup engine — pure functions over a creator's OWN posts (and a
// brand's OWN campaign). No comparison to other creators, no scores, no ranking
// beyond a creator's/campaign's own top post. Money is in integer-ish cents
// (cents-per-view may be fractional; the UI formats it).

import type { Platform } from './adapters/types'
// Engagement = (likes + comments + shares) / views — single source of truth.
// Saves/reach are kept on the model for storage/display (Instagram) but are NOT
// part of the rate (TikTok's API never returns them).
import { interactions, engagementRate as rate, num as n } from './engagement'

export interface RollupPost {
  platform: Platform
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
  postedAt: Date | null
  collabId?: string | null
  url?: string | null
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

export interface MetricTotals {
  views: number; likes: number; comments: number; shares: number; saves: number; reach: number
}
function totalsOf(posts: RollupPost[]): MetricTotals {
  return posts.reduce(
    (t, p) => ({
      views: t.views + n(p.views), likes: t.likes + n(p.likes), comments: t.comments + n(p.comments),
      shares: t.shares + n(p.shares), saves: t.saves + n(p.saves), reach: t.reach + n(p.reach),
    }),
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0 },
  )
}

export interface CreatorRollup {
  posts: number
  totals: MetricTotals
  averages: { views: number | null; engagementRate: number | null; reach: number | null; saves: number | null }
  byPlatform: Record<string, { posts: number; totals: MetricTotals; avgEngagementRate: number | null }>
  bestPosts: { url: string | null; platform: Platform; interactions: number }[]
  worstPosts: { url: string | null; platform: Platform; interactions: number }[]
}

export function computeCreatorRollup(posts: RollupPost[]): CreatorRollup {
  const byPlatform: CreatorRollup['byPlatform'] = {}
  for (const p of posts) {
    const b = byPlatform[p.platform] ?? { posts: 0, totals: totalsOf([]), avgEngagementRate: null }
    byPlatform[p.platform] = b
  }
  for (const key of Object.keys(byPlatform)) {
    const ps = posts.filter((p) => p.platform === key)
    byPlatform[key] = {
      posts: ps.length,
      totals: totalsOf(ps),
      avgEngagementRate: avg(ps.map(rate).filter((x): x is number => x != null)),
    }
  }
  const ranked = [...posts].sort((a, b) => interactions(b) - interactions(a))
  const slim = (p: RollupPost) => ({ url: p.url ?? null, platform: p.platform, interactions: interactions(p) })
  return {
    posts: posts.length,
    totals: totalsOf(posts),
    averages: {
      views: avg(posts.map((p) => p.views).filter((x): x is number => x != null)),
      engagementRate: avg(posts.map(rate).filter((x): x is number => x != null)),
      reach: avg(posts.map((p) => p.reach).filter((x): x is number => x != null)),
      saves: avg(posts.map((p) => p.saves).filter((x): x is number => x != null)),
    },
    byPlatform,
    bestPosts: ranked.slice(0, 5).map(slim),
    worstPosts: ranked.slice(-5).reverse().map(slim),
  }
}

export interface CampaignCreatorInput {
  creatorId: string
  handle?: string | null
  posts: RollupPost[]
  payoutCents: number
}
export interface CampaignRollup {
  totals: MetricTotals & { spendCents: number; engagement: number }
  derived: { cpvCents: number | null; cpeCents: number | null; engagementRate: number | null }
  byPlatform: Record<string, MetricTotals>
  perCreator: {
    creatorId: string; handle: string | null
    totals: MetricTotals; engagement: number; spendCents: number
    cpvCents: number | null; cpeCents: number | null
  }[]
  topPost: { url: string | null; platform: Platform; interactions: number } | null
}

export function computeCampaignRollup(creators: CampaignCreatorInput[]): CampaignRollup {
  const allPosts = creators.flatMap((c) => c.posts)
  const totals = totalsOf(allPosts)
  const engagement = allPosts.reduce((s, p) => s + interactions(p), 0)
  const spendCents = creators.reduce((s, c) => s + (c.payoutCents || 0), 0)

  const byPlatform: Record<string, MetricTotals> = {}
  for (const p of allPosts) byPlatform[p.platform] = byPlatform[p.platform] ?? totalsOf([])
  for (const key of Object.keys(byPlatform)) byPlatform[key] = totalsOf(allPosts.filter((p) => p.platform === key))

  const perCreator = creators.map((c) => {
    const t = totalsOf(c.posts)
    const eng = c.posts.reduce((s, p) => s + interactions(p), 0)
    return {
      creatorId: c.creatorId, handle: c.handle ?? null, totals: t, engagement: eng, spendCents: c.payoutCents || 0,
      cpvCents: t.views > 0 ? (c.payoutCents || 0) / t.views : null,
      cpeCents: eng > 0 ? (c.payoutCents || 0) / eng : null,
    }
  })

  const topPostRaw = [...allPosts].sort((a, b) => interactions(b) - interactions(a))[0]
  return {
    totals: { ...totals, spendCents, engagement },
    derived: {
      cpvCents: totals.views > 0 ? spendCents / totals.views : null,
      cpeCents: engagement > 0 ? spendCents / engagement : null,
      engagementRate: totals.views > 0 ? engagement / totals.views : null,
    },
    byPlatform,
    perCreator,
    topPost: topPostRaw
      ? { url: topPostRaw.url ?? null, platform: topPostRaw.platform, interactions: interactions(topPostRaw) }
      : null,
  }
}
