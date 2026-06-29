import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { exchangeCode, oauthConfigured, type OAuthPlatform } from '@/lib/analytics/oauth'
import { isCreatorProActive } from '@/lib/creator-pro'

export const runtime = 'nodejs'

const OAUTH_PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const

// Resolves the platform account id + handle from an access token. ⚠️ Endpoints
// follow the documented "who am I" calls; verify at integration. Null-safe.
async function resolveAccount(platform: OAuthPlatform, token: string, tokenExternalId: string | null) {
  try {
    if (platform === 'tiktok') {
      // open_id came from the token response; it is also the provider user id.
      return { externalId: tokenExternalId, handle: null, providerUserId: tokenExternalId }
    }
    if (platform === 'youtube') {
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { authorization: `Bearer ${token}` },
      })
      const d: any = await res.json()
      const it = d?.items?.[0]
      return { externalId: it?.id ?? null, handle: it?.snippet?.title ?? null, providerUserId: it?.id ?? null }
    }
    // instagram (Instagram Login): the IG user id came from the token response.
    // Fetch the username for display; the id is also the provider user id used by
    // Meta's deauthorize/deletion callbacks.
    let handle: string | null = null
    try {
      const me = await fetch('https://graph.instagram.com/me?' + new URLSearchParams({ fields: 'username', access_token: token })).then((r) => r.json())
      handle = me?.username ?? null
    } catch { /* username is best effort */ }
    return { externalId: tokenExternalId, handle, providerUserId: tokenExternalId }
  } catch {
    return { externalId: tokenExternalId, handle: null, providerUserId: tokenExternalId }
  }
}

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const platform = params.platform as OAuthPlatform
  if (!OAUTH_PLATFORMS.includes(platform) || !oauthConfigured(platform)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const studio = (q: string) => NextResponse.redirect(new URL(`/studio?${q}`, req.url))
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const cookieState = req.cookies.get(`cl_oauth_${platform}`)?.value
  if (req.nextUrl.searchParams.get('error') || !code) return studio('connect=cancelled')
  if (!state || !cookieState || state !== cookieState) return studio('connect=bad_state')

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return studio('connect=error')
  if (!(await isCreatorProActive(admin, creator.id))) return studio('connect=pro_required')

  const tokens = await exchangeCode(platform, code)
  if (!tokens) return studio('connect=token_failed')

  const { externalId, handle, providerUserId } = await resolveAccount(platform, tokens.accessToken, tokens.externalId)
  if (!externalId) return studio('connect=no_account')

  const { data: acct, error } = await admin.from('connected_accounts').upsert(
    {
      creator_id: creator.id, platform, source: 'native',
      external_account_id: externalId, provider_user_id: providerUserId, handle, status: 'connected',
      sync_frozen: false, consent_at: new Date().toISOString(),
    },
    { onConflict: 'creator_id,platform' },
  ).select('id').single()
  if (error || !acct) return studio('connect=error')

  await admin.from('connected_account_tokens').upsert({
    account_id: acct.id, access_token: tokens.accessToken, refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt, scope: tokens.scope, updated_at: new Date().toISOString(),
  }, { onConflict: 'account_id' })

  // Connect is INSTANT: never sync inline here (a slow account would time out the
  // OAuth callback). We just queue the work and redirect; the Studio runs the sync
  // with a proper loading UI right after landing (see PostConnectSync), and the
  // cron drains the queue as a backup.
  await admin.from('sync_jobs').insert({ account_id: acct.id, kind: 'account', status: 'queued' })

  const res = studio(`connected=${platform}`)
  res.cookies.delete(`cl_oauth_${platform}`)
  return res
}
