import { randomBytes, createHash } from 'crypto'
import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Claim-link tokens for admin-seeded creator profiles (concierge beta). Pure
 * token lifecycle only - no brand/campaign context lives here (see
 * pending_collab_requests / lib/invites.ts for "who wants this creator").
 *
 * Deliberately NOT the stateless HMAC pattern used for unsubscribeToken in
 * lib/email.ts - that token never expires, isn't single-use, and isn't
 * revocable (it's a pure function of userId, so the same input always
 * produces the same output forever). A claim link needs all three, so this
 * is DB-backed: a random 256-bit token, hashed at rest (sha256, never the
 * raw token) in creator_claims, checked and atomically consumed there.
 */

const DEFAULT_TTL_DAYS = 30

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Raw, URL-safe token - only ever exists in memory and in the URL you copy. */
function generateToken(): string {
  return randomBytes(32).toString('base64url') // 256 bits of entropy
}

/** Issues a fresh claim token for a creator. Does not revoke prior tokens for
 *  the same creator - callers that want "only one active link" should revoke
 *  first (see revokeActiveClaims / the admin "regenerate" action). */
export async function issueClaimToken(
  admin: Admin,
  opts: { creatorId: string; createdBy: string; ttlDays?: number },
): Promise<{ token: string; expiresAt: string }> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await admin.from('creator_claims').insert({
    creator_id: opts.creatorId,
    token_hash: hashToken(token),
    created_by: opts.createdBy,
    expires_at: expiresAt,
  })
  if (error) throw new Error(`Could not issue claim token: ${error.message}`)
  return { token, expiresAt }
}

export type ClaimStatus = 'valid' | 'not_found' | 'expired' | 'used' | 'revoked'

export interface ClaimRow {
  id: string
  creator_id: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
}

/** Read-only validation - safe to call from a GET (e.g. a DM link-preview
 *  crawler hitting the claim page must never consume the token). */
export async function validateClaimToken(admin: Admin, token: string): Promise<{ status: ClaimStatus; claim: ClaimRow | null }> {
  const { data: claim } = await admin.from('creator_claims')
    .select('id, creator_id, expires_at, used_at, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle<ClaimRow>()
  if (!claim) return { status: 'not_found', claim: null }
  if (claim.revoked_at) return { status: 'revoked', claim }
  if (claim.used_at) return { status: 'used', claim }
  if (new Date(claim.expires_at).getTime() < Date.now()) return { status: 'expired', claim }
  return { status: 'valid', claim }
}

/** Atomically consumes a token - the WHERE clause is the actual security
 *  boundary against double-claim races, same idiom as ensureSlug's
 *  `.is('slug', null)` conditional update. Returns the claimed row, or null
 *  if it was already consumed/revoked/expired between validate and consume
 *  (caller should re-validate and show a fresh error, not assume success). */
export async function consumeClaimToken(admin: Admin, token: string): Promise<ClaimRow | null> {
  const { data, error } = await admin.from('creator_claims')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', hashToken(token))
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id, creator_id, expires_at, used_at, revoked_at')
    .maybeSingle<ClaimRow>()
  if (error) throw new Error(`Could not consume claim token: ${error.message}`)
  return data
}

/** Records the first time a claim resolved 'valid' on a GET - a funnel signal
 *  only (generated → opened → claimed → onboarded), never a consumption. The
 *  `is('opened_at', null)` guard means only the first hit counts, so re-visits
 *  (and a DM-preview crawler that fetches before the human does) don't skew
 *  "time to open." Best-effort: a failure here must never break the claim
 *  page itself, so it only logs. */
export async function markClaimOpened(admin: Admin, claimId: string): Promise<void> {
  const { error } = await admin.from('creator_claims')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', claimId)
    .is('opened_at', null)
  if (error) console.error('[CLAIM] could not record open:', error.message)
}

/** Revokes every still-active (unused, unexpired, unrevoked) claim for a
 *  creator - used by the admin "revoke" action and before "regenerate". */
export async function revokeActiveClaims(admin: Admin, creatorId: string): Promise<void> {
  const { error } = await admin.from('creator_claims')
    .update({ revoked_at: new Date().toISOString() })
    .eq('creator_id', creatorId)
    .is('used_at', null)
    .is('revoked_at', null)
  if (error) throw new Error(`Could not revoke claim tokens: ${error.message}`)
}

/** Latest active (unused, unrevoked, unexpired) claim for a creator, if any -
 *  drives the admin list's "has an active link" display. */
export async function activeClaimForCreator(admin: Admin, creatorId: string) {
  const { data } = await admin.from('creator_claims')
    .select('id, expires_at, created_at')
    .eq('creator_id', creatorId)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
