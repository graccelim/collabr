import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Lightweight in-memory sliding-window rate limiter. Per server instance and
// reset on deploy - intentionally simple spam friction, not a hard guarantee.
// Durable limits (e.g. applications/hour) are counted against the database
// in the route itself. Security-sensitive routes use checkRateLimitDurable
// (below), which backs the same window with the rate_limit_events table.

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

/**
 * Durable sliding-window limit backed by the rate_limit_events table
 * (migration 051) — survives deploys and is shared across serverless
 * instances. The in-memory check runs first as a cheap fast-path; if the DB
 * call fails (or 051 isn't applied yet) we fail OPEN to the in-memory result
 * so an outage never locks users out of signup.
 */
export async function checkRateLimitDurable(
  key: string, limit: number, windowMs: number,
): Promise<boolean> {
  if (!checkRateLimit(key, limit, windowMs)) return false
  try {
    const { data, error } = await createAdminClient().rpc('rate_limit_hit', {
      p_key: key,
      p_max: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    })
    if (error) {
      console.error('[RATE_LIMIT] durable check failed, falling back to in-memory:', error.message)
      return true
    }
    return data === true
  } catch (e: any) {
    console.error('[RATE_LIMIT] durable check failed, falling back to in-memory:', e?.message)
    return true
  }
}

/** Best-effort client IP for keying anonymous rate limits. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
