import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { exchangeCode, oauthConfigured, type OAuthPlatform } from '@/lib/analytics/oauth'
import { isCreatorProActive } from '@/lib/creator-pro'

const OAUTH_PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const

// Resolves the platform account id + handle from an access token. ⚠️ Endpoints
// follow the documented "who am I" calls; verify at integration. Null-safe.
async function resolveAccount(platform: OAuthPlatform, token: string, tokenExternalId: string | null) {
  try {
    if (platform === 'tiktok') {
      return { externalId: tokenExternalId, handle: null } // open_id came from the token response
    }
    if (platform === 'youtube') {
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { authorization: `Bearer ${token}` },
      })
      const d: any = await res.json()
      const it = d?.items?.[0]
      return { externalId: it?.id ?? null, handle: it?.snippet?.title ?? null }
    }
    // instagram: page → linked IG business account.
    const res = await fetch('https://graph.facebook.com/v21.0/me/accounts?' + new URLSearchParams({
      fields: 'instagram_business_account{id,username}', access_token: token,
    }))
    const d: any = await res.json()
    const ig = d?.data?.find((p: any) => p?.instagram_business_account)?.instagram_business_account
    return { externalId: ig?.id ?? null, handle: ig?.username ?? null }
  } catch {
    return { externalId: tokenExternalId, handle: null }
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

  const { externalId, handle } = await resolveAccount(platform, tokens.accessToken, tokens.externalId)
  if (!externalId) return studio('connect=no_account')

  const { data: acct, error } = await admin.from('connected_accounts').upsert(
    {
      creator_id: creator.id, platform, source: 'native',
      external_account_id: externalId, handle, status: 'connected',
      sync_frozen: false, consent_at: new Date().toISOString(),
    },
    { onConflict: 'creator_id,platform' },
  ).select('id').single()
  if (error || !acct) return studio('connect=error')

  await admin.from('connected_account_tokens').upsert({
    account_id: acct.id, access_token: tokens.accessToken, refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt, scope: tokens.scope, updated_at: new Date().toISOString(),
  }, { onConflict: 'account_id' })
  await admin.from('sync_jobs').insert({ account_id: acct.id, kind: 'account', status: 'queued' })

  const res = studio(`connected=${platform}`)
  res.cookies.delete(`cl_oauth_${platform}`)
  return res
}
