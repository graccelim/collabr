// Content DNA — deterministic, self-only summaries of a creator's OWN posts.
// 100% computed (no AI generates these values). No cross-creator comparison, no
// rankings, no scores. Every dimension carries a confidence flag so thin data
// degrades to "insufficient" instead of guessing.
//
// Pure: feed it the creator's NormalizedPost[]; get back a ContentDna object.
// (Times/days are computed in UTC here; a later pass can use creator timezone.)

import type { NormalizedPost, Platform } from './adapters/types'

const MIN_SAMPLE = 3 // a dimension needs at least this many usable posts

export type Confidence = 'ok' | 'insufficient'

export interface DnaGroup {
  key: string
  avgEngagementRate: number | null // 0..1, null when no post in the group had a denominator
  avgInteractions: number
  posts: number
}

export interface ContentDna {
  window: string
  averages: {
    views: number | null
    engagementRate: number | null
    reach: number | null
    saves: number | null
  }
  bestPlatforms: DnaGroup[]
  bestCategories: DnaGroup[]
  bestContentStyles: DnaGroup[]
  bestPostingDays: DnaGroup[]
  bestPostingTimes: DnaGroup[]
  bestVideoLength: DnaGroup | null
  postingConsistency: { postsPerWeek: number | null; gapStdDevDays: number | null } | null
  confidence: Record<string, Confidence>
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function interactions(p: NormalizedPost): number {
  return (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)
}
/** Engagement rate when a denominator (views, else reach) exists; null otherwise. */
function rate(p: NormalizedPost): number | null {
  const denom = p.views ?? p.reach
  if (denom == null || denom <= 0) return null
  return interactions(p) / denom
}
function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}
function avgOf(posts: NormalizedPost[], pick: (p: NormalizedPost) => number | null): number | null {
  return avg(posts.map(pick).filter((n): n is number => n != null))
}

/** Group posts by a key, summarise each group, sort by avg interactions desc. */
function group(posts: NormalizedPost[], keyOf: (p: NormalizedPost) => string | null): DnaGroup[] {
  const buckets = new Map<string, NormalizedPost[]>()
  for (const p of posts) {
    const k = keyOf(p)
    if (k == null) continue
    const arr = buckets.get(k) ?? []
    arr.push(p)
    buckets.set(k, arr)
  }
  return Array.from(buckets.entries())
    .map(([key, ps]) => ({
      key,
      avgEngagementRate: avgOf(ps, rate),
      avgInteractions: avg(ps.map(interactions)) ?? 0,
      posts: ps.length,
    }))
    .sort((a, b) => b.avgInteractions - a.avgInteractions || a.key.localeCompare(b.key))
}

function lengthBucket(sec: number | null | undefined): string | null {
  if (sec == null) return null
  if (sec < 15) return '<15s'
  if (sec < 30) return '15–30s'
  if (sec < 60) return '30–60s'
  return '60s+'
}
function timeBucket(d: Date): string {
  const h = d.getUTCHours()
  if (h < 6) return 'Night (12–6am)'
  if (h < 12) return 'Morning (6–12pm)'
  if (h < 18) return 'Afternoon (12–6pm)'
  return 'Evening (6–12am)'
}

function stdDev(nums: number[]): number | null {
  if (nums.length < 2) return null
  const m = nums.reduce((a, b) => a + b, 0) / nums.length
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length
  return Math.sqrt(v)
}

export function computeContentDna(posts: NormalizedPost[], window = '90d'): ContentDna {
  const withDate = posts.filter((p): p is NormalizedPost & { postedAt: Date } => p.postedAt != null)
  const enoughOverall = posts.length >= MIN_SAMPLE

  const platforms = group(posts, (p) => p.platform as Platform)
  const categories = group(posts, (p) => p.category ?? null)
  const styles = group(posts, (p) => p.style ?? null)
  const days = group(withDate, (p) => (p.postedAt ? WEEKDAYS[p.postedAt.getUTCDay()] : null))
  const times = group(withDate, (p) => (p.postedAt ? timeBucket(p.postedAt) : null))
  const lengths = group(posts, (p) => lengthBucket(p.durationSec))

  // Posting consistency from sorted post dates.
  let consistency: ContentDna['postingConsistency'] = null
  if (withDate.length >= 2) {
    const ts = withDate.map((p) => p.postedAt.getTime()).sort((a, b) => a - b)
    const spanDays = (ts[ts.length - 1] - ts[0]) / 86_400_000
    const gaps: number[] = []
    for (let i = 1; i < ts.length; i++) gaps.push((ts[i] - ts[i - 1]) / 86_400_000)
    consistency = {
      postsPerWeek: spanDays > 0 ? +(withDate.length / (spanDays / 7)).toFixed(2) : null,
      gapStdDevDays: stdDev(gaps) != null ? +stdDev(gaps)!.toFixed(2) : null,
    }
  }

  const conf = (g: DnaGroup[]): Confidence =>
    enoughOverall && g.reduce((n, x) => n + x.posts, 0) >= MIN_SAMPLE ? 'ok' : 'insufficient'

  return {
    window,
    averages: {
      views: avgOf(posts, (p) => p.views),
      engagementRate: avgOf(posts, rate),
      reach: avgOf(posts, (p) => p.reach),
      saves: avgOf(posts, (p) => p.saves),
    },
    bestPlatforms: platforms,
    bestCategories: categories,
    bestContentStyles: styles,
    bestPostingDays: days,
    bestPostingTimes: times,
    bestVideoLength: lengths[0] ?? null,
    postingConsistency: consistency,
    confidence: {
      overall: enoughOverall ? 'ok' : 'insufficient',
      platforms: conf(platforms),
      categories: conf(categories),
      styles: conf(styles),
      postingDays: conf(days),
      postingTimes: conf(times),
      videoLength: conf(lengths),
    },
  }
}
