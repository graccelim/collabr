// Resolves the auth an adapter needs for one connected account, refreshing OAuth
// tokens when near expiry. Every platform (including YouTube now) uses the
// creator's own OAuth token, so we only show data for accounts they own.
// Tokens live in the private connected_account_tokens table (service-role only).
import type { createAdminClient } from '@/lib/supabase/server'
import type { AdapterAuth, Platform } from './adapters/types'
import { refreshAccessToken, type OAuthPlatform } from './oauth'

const EXPIRY_BUFFER_MS = 5 * 60 * 1000

export async function getAccountAuth(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
  platform: Platform,
): Promise<AdapterAuth | null> {

  const { data: tok } = await admin.from('connected_account_tokens')
    .select('access_token, refresh_token, expires_at').eq('account_id', accountId).maybeSingle()
  if (!tok?.access_token) return null

  const expMs = tok.expires_at ? new Date(tok.expires_at).getTime() : null
  if (expMs && expMs - Date.now() < EXPIRY_BUFFER_MS && tok.refresh_token) {
    const refreshed = await refreshAccessToken(platform as OAuthPlatform, tok.refresh_token)
    if (refreshed) {
      await admin.from('connected_account_tokens').update({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken ?? tok.refresh_token,
        expires_at: refreshed.expiresAt, updated_at: new Date().toISOString(),
      }).eq('account_id', accountId)
      return { accessToken: refreshed.accessToken }
    }
  }
  return { accessToken: tok.access_token }
}
