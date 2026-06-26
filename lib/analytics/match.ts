// Deterministic post↔collab matching. Links a synced post to a Collabr collab
// ONLY when its URL exactly equals the canonical live-post URL (live_posts.post_url)
// after conservative normalization. Never guesses: ambiguous or no match → null
// (left unlinked, retried on later syncs).

// Tracking params that don't change which post a URL points to. Significant
// params (e.g. YouTube ?v=) are KEPT so we never collapse distinct videos.
const TRACKING = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'igshid', 'igsh', 'si', 'feature', 'fbclid', 'gclid', 'ref', 'ref_src',
])

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  const path = u.pathname.replace(/\/+$/, '') // drop trailing slash(es)
  const params = Array.from(u.searchParams.entries())
    .filter(([k]) => !TRACKING.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
  const qs = params.length ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&') : ''
  return `${host}${path}${qs}`.toLowerCase()
}

/**
 * Returns the collab id whose canonical URL exactly matches `postUrl`, or null.
 * If more than one DISTINCT collab matches, returns null (never guess).
 */
export function matchPostToCollab(
  postUrl: string,
  collabUrls: { collabId: string; url: string | null }[],
): string | null {
  const target = normalizeUrl(postUrl)
  if (!target) return null
  const ids = Array.from(new Set(
    collabUrls.filter((c) => normalizeUrl(c.url) === target).map((c) => c.collabId),
  ))
  return ids.length === 1 ? ids[0] : null
}
