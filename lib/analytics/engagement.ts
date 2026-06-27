// Cross-platform engagement math — the single source of truth.
//
// Reality of the public APIs we sync from: TikTok's Display/Graph `video.list`
// returns ONLY view_count, like_count, comment_count and share_count. It exposes
// neither reach (unique viewers) nor saves (favourites) per video. So engagement
// is defined strictly as:
//
//     (likes + comments + shares) / views
//
//  - Saves are NOT in the numerator (TikTok never returns them; this keeps the
//    metric identical and comparable across platforms).
//  - The denominator is strictly view_count — there is NO reach fallback, because
//    reach will never populate from the TikTok payload.
//  - Any missing/undefined/NaN metric is coerced to 0, so we never produce NaN.
//  - Missing or zero views returns null (the post is excluded from averages),
//    never a divide-by-zero / Infinity.
//
// Instagram/YouTube may still STORE saves/reach (their columns are nullable) for
// display, but they are deliberately not part of this rate.

export interface EngagementMetrics {
  views?: number | null
  likes?: number | null
  comments?: number | null
  shares?: number | null
}

/** Safe number: null/undefined/NaN/Infinity all collapse to 0. */
export const num = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0

/** Engagement numerator: likes + comments + shares (saves excluded). */
export function interactions(p: EngagementMetrics): number {
  return num(p.likes) + num(p.comments) + num(p.shares)
}

/** Engagement rate = interactions / views. Null when there are no views. */
export function engagementRate(p: EngagementMetrics): number | null {
  const views = num(p.views)
  if (views <= 0) return null
  return interactions(p) / views
}
