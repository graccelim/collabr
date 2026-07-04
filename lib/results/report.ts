// Self-reported campaign results — pure logic (deterministic, unit-tested).
//
// Creators report their post's real metrics per completed collab (compliant, no
// scraping/OAuth). Brands see per-collab numbers plus per-campaign and brand-wide
// totals. Everything here is pure: DB rows map INTO these shapes, and nothing
// fabricates numbers — a total is null unless at least one row actually reported it.
import { z } from 'zod'

// ── Creator input validation ────────────────────────────────────────────────
const metric = z.number().int().min(0).max(10_000_000_000).nullish()
export const collabResultSchema = z
  .object({
    views: metric,
    likes: metric,
    comments: metric,
    shares: metric,
    saves: metric,
    reach: metric,
    post_url: z.string().trim().url().max(500),
  })
  .refine((v) => [v.views, v.likes, v.comments, v.shares, v.saves, v.reach].some((x) => x != null), {
    message: 'Add at least one number (views, likes or comments).',
  })
export type CollabResultInput = z.infer<typeof collabResultSchema>

// ── Aggregation ─────────────────────────────────────────────────────────────
export interface ResultRow {
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
}

export interface AggregateResults {
  reportedCount: number
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
  /** likes + comments + shares + saves (only the metrics that were reported). */
  engagement: number | null
  /** engagement / views, 0..1, null when views are missing/zero. */
  engagementRate: number | null
}

/**
 * Sum a set of reported results. A per-metric total is null only when NO row
 * reported that metric (so we never invent a fake 0 across the board); otherwise
 * it is the sum of the present values.
 */
export function aggregateResults(rows: ResultRow[]): AggregateResults {
  const sum = (k: keyof ResultRow): number | null => {
    const present = rows.map((r) => r[k]).filter((n): n is number => typeof n === 'number')
    return present.length ? present.reduce((a, b) => a + b, 0) : null
  }
  const views = sum('views')
  const likes = sum('likes')
  const comments = sum('comments')
  const shares = sum('shares')
  const saves = sum('saves')
  const reach = sum('reach')
  const engParts = [likes, comments, shares, saves].filter((n): n is number => n != null)
  const engagement = engParts.length ? engParts.reduce((a, b) => a + b, 0) : null
  const engagementRate = engagement != null && views != null && views > 0 ? engagement / views : null
  return { reportedCount: rows.length, views, likes, comments, shares, saves, reach, engagement, engagementRate }
}

// ── Reporting rate + badge ──────────────────────────────────────────────────
export interface ReportingInput {
  completedAt: Date | null
  reportedAt: Date | null
}
export interface ReportingRate {
  /** Completed collabs old enough that results are due (past the grace window). */
  eligible: number
  /** Of those, how many the creator reported. */
  reported: number
  /** reported / eligible, 0..1, null when nothing is due yet. */
  rate: number | null
}

/**
 * Of the creator's collabs that completed at least `windowDays` ago (so they had
 * time + the reminder), how many have reported results. Recently-completed collabs
 * are NOT counted against them.
 */
export function reportingRate(collabs: ReportingInput[], now: Date, windowDays = 14): ReportingRate {
  const cutoff = now.getTime() - windowDays * 86_400_000
  const eligible = collabs.filter((c) => c.completedAt != null && c.completedAt.getTime() <= cutoff)
  const reported = eligible.filter((c) => c.reportedAt != null).length
  return { eligible: eligible.length, reported, rate: eligible.length ? reported / eligible.length : null }
}

/** "Shares results" badge: reliably reports across a meaningful sample. */
export function sharesResults(rate: ReportingRate, minEligible = 3, threshold = 0.8): boolean {
  return rate.eligible >= minEligible && rate.rate != null && rate.rate >= threshold
}
