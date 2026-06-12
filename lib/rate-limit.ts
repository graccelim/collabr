import { NextRequest } from 'next/server'

// Lightweight in-memory sliding-window rate limiter. Per server instance and
// reset on deploy — intentionally simple spam friction, not a hard guarantee.
// Durable limits (e.g. applications/hour) are counted against the database
// in the route itself.

const buckets = new Map<string, number[]>()
const MAX_BUCKETS = 10_000

/** Returns true when the call is allowed, false when rate-limited. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > MAX_BUCKETS) {
    Array.from(buckets.entries()).forEach(([k, hits]) => {
      if (hits.every(t => t < cutoff)) buckets.delete(k)
    })
  }

  const hits = (buckets.get(key) || []).filter(t => t >= cutoff)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

/** Best-effort client IP for keying anonymous rate limits. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
