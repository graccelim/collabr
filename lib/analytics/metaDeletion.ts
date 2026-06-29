import crypto from 'crypto'
import { recomputeCreatorInsights } from './sync'

type Admin = Parameters<typeof recomputeCreatorInsights>[0]

/** Verify and decode a Meta `signed_request` (HMAC-SHA256 with the app secret). */
export function parseSignedRequest(signed: string, secret: string): { user_id?: string } | null {
  const [encSig, encPayload] = signed.split('.')
  if (!encSig || !encPayload) return null
  const dec = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const expected = crypto.createHmac('sha256', secret).update(encPayload).digest()
  const sig = dec(encSig)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null
  try {
    return JSON.parse(dec(encPayload).toString('utf8'))
  } catch {
    return null
  }
}

/**
 * Delete every Instagram account (and everything we derived from it) tied to a
 * Meta app-scoped user id. Shared by the Deauthorize and Data Deletion callbacks.
 * Mirrors the disconnect (DELETE) flow. Returns how many accounts were purged.
 */
export async function purgeMetaUser(admin: Admin, metaUserId: string): Promise<number> {
  const { data: accts } = await admin
    .from('connected_accounts')
    .select('id, creator_id, platform')
    .eq('platform', 'instagram')
    .eq('provider_user_id', metaUserId)
  let purged = 0
  for (const acct of accts ?? []) {
    const { data: postIds } = await admin.from('content_posts').select('id').eq('account_id', acct.id)
    const ids = (postIds ?? []).map((p: { id: string }) => p.id)
    if (ids.length) await admin.from('post_snapshots').delete().in('post_id', ids)
    await admin.from('content_posts').delete().eq('account_id', acct.id)
    await admin.from('account_snapshots').delete().eq('account_id', acct.id)
    await admin.from('creator_platform_insights').delete().eq('creator_id', acct.creator_id).eq('platform', 'instagram')
    await admin.from('connected_account_tokens').delete().eq('account_id', acct.id)
    await admin.from('sync_jobs').delete().eq('account_id', acct.id)
    await admin.from('connected_accounts').delete().eq('id', acct.id)

    const stillConnected = await recomputeCreatorInsights(admin, acct.creator_id as string)
    if (!stillConnected) {
      await admin.from('creator_rollups').delete().eq('creator_id', acct.creator_id)
      await admin.from('creator_profiles').update({ connected: false, connected_platforms: [] }).eq('id', acct.creator_id)
    }
    purged++
  }
  return purged
}
