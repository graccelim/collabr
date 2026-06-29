// First-party social OAuth (no Phyllo). Per-platform authorize/token/refresh.
// Env-driven and fail-safe: if a platform's app credentials are absent, that
// platform is simply "not configured" (the UI hides it, routes 404/503).
//
// ⚠️ The exact endpoint URLs, params and token-response field names follow each
// platform's documented OAuth flow but are NOT verified against the live APIs
// here. Confirm them against the platform dashboards at integration (search
// "<platform> OAuth token endpoint"). Never fabricate tokens.

import type { Platform } from './adapters/types'

export type OAuthPlatform = 'instagram' | 'tiktok' | 'youtube'

export interface TokenSet {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null // ISO
  scope: string | null
  externalId: string | null // e.g. TikTok open_id, when the token response carries it
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}
export function redirectUri(platform: OAuthPlatform): string {
  return `${appUrl()}/api/connected/oauth/${platform}/callback`
}

// ── Credential presence (each platform independent) ─────────────────────────
export function instagramConfigured(): boolean {
  // Instagram API with Instagram Login uses the Instagram app credentials,
  // separate from any Meta/Facebook app id+secret. Falls back to META_* so an
  // older Facebook-Login config keeps working until the Instagram creds are set.
  return Boolean((process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID) && (process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET))
}
export function igAppId(): string | undefined {
  return process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID
}
export function igAppSecret(): string | undefined {
  return process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET
}
export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
}
// Accept either GOOGLE_OAUTH_* (canonical, in .env.example) or the shorter
// GOOGLE_CLIENT_* names, so a common naming slip doesn't silently hide YouTube.
export function googleClientId(): string | undefined {
  return process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
}
export function googleClientSecret(): string | undefined {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
}
export function googleOauthConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret())
}
export function youtubeApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null
}
export function oauthConfigured(platform: OAuthPlatform): boolean {
  if (platform === 'instagram') return instagramConfigured()
  if (platform === 'tiktok') return tiktokConfigured()
  if (platform === 'youtube') return googleOauthConfigured()
  return false
}
/** A platform is connectable if it has OAuth creds, or (YouTube) a public API key. */
export function platformConnectable(platform: Platform): boolean {
  if (platform === 'youtube') return googleOauthConfigured()
  if (platform === 'instagram') return instagramConfigured()
  if (platform === 'tiktok') return tiktokConfigured()
  return false
}

// ── Authorize URL ───────────────────────────────────────────────────────────
export function authorizeUrl(platform: OAuthPlatform, state: string): string | null {
  if (!oauthConfigured(platform)) return null
  const ru = encodeURIComponent(redirectUri(platform))
  if (platform === 'instagram') {
    // Instagram API with Instagram Login (direct IG login, no Facebook Page).
    const scope = encodeURIComponent('instagram_business_basic,instagram_business_manage_insights')
    return `https://www.instagram.com/oauth/authorize?client_id=${igAppId()}` +
      `&redirect_uri=${ru}&state=${state}&response_type=code&scope=${scope}`
  }
  if (platform === 'tiktok') {
    const scope = encodeURIComponent('user.info.basic,user.info.stats,video.list')
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}` +
      `&scope=${scope}&response_type=code&redirect_uri=${ru}&state=${state}`
  }
  // youtube (Google) — read-only access to the creator's OWN channel + videos
  // (proves ownership via channels?mine=true). Offline access for a refresh token.
  const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly')
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId()}` +
    `&redirect_uri=${ru}&response_type=code&access_type=offline&prompt=consent&scope=${scope}&state=${state}`
}

function expiry(seconds: number | null | undefined): string | null {
  return seconds ? new Date(Date.now() + seconds * 1000).toISOString() : null
}

// ── Exchange authorization code → tokens ────────────────────────────────────
export async function exchangeCode(platform: OAuthPlatform, code: string): Promise<TokenSet | null> {
  if (!oauthConfigured(platform)) return null
  try {
    if (platform === 'tiktok') {
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!,
          code, grant_type: 'authorization_code', redirect_uri: redirectUri('tiktok'),
        }),
      })
      const d: any = await res.json()
      if (!res.ok || !d?.access_token) return null
      return { accessToken: d.access_token, refreshToken: d.refresh_token ?? null, expiresAt: expiry(d.expires_in), scope: d.scope ?? null, externalId: d.open_id ?? null }
    }
    if (platform === 'youtube') {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: googleClientId()!, client_secret: googleClientSecret()!,
          redirect_uri: redirectUri('youtube'), grant_type: 'authorization_code',
        }),
      })
      const d: any = await res.json()
      if (!res.ok || !d?.access_token) return null
      return { accessToken: d.access_token, refreshToken: d.refresh_token ?? null, expiresAt: expiry(d.expires_in), scope: d.scope ?? null, externalId: null }
    }
    // instagram (Instagram Login): code → short-lived (api.instagram.com, carries
    // the IG user_id) → long-lived (graph.instagram.com, ~60d).
    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: igAppId()!, client_secret: igAppSecret()!,
        grant_type: 'authorization_code', redirect_uri: redirectUri('instagram'), code,
      }),
    })
    const short: any = await shortRes.json()
    if (!shortRes.ok || !short?.access_token) return null
    const userId = short?.user_id != null ? String(short.user_id) : null
    const longRes = await fetch('https://graph.instagram.com/access_token?' + new URLSearchParams({
      grant_type: 'ig_exchange_token', client_secret: igAppSecret()!, access_token: short.access_token,
    }))
    const long: any = await longRes.json()
    const token = long?.access_token || short.access_token
    // refreshToken = the long-lived token itself (refreshed via ig_refresh_token).
    return { accessToken: token, refreshToken: token, expiresAt: expiry(long?.expires_in ?? 3600), scope: null, externalId: userId }
  } catch (e: any) {
    console.error(`[oauth ${platform}] exchange failed:`, e?.message)
    return null
  }
}

// ── Refresh an access token (called by the sync cron before it expires) ──────
export async function refreshAccessToken(platform: OAuthPlatform, refreshToken: string): Promise<TokenSet | null> {
  if (!oauthConfigured(platform) || !refreshToken) return null
  try {
    if (platform === 'tiktok') {
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!,
          grant_type: 'refresh_token', refresh_token: refreshToken,
        }),
      })
      const d: any = await res.json()
      if (!res.ok || !d?.access_token) return null
      return { accessToken: d.access_token, refreshToken: d.refresh_token ?? refreshToken, expiresAt: expiry(d.expires_in), scope: d.scope ?? null, externalId: d.open_id ?? null }
    }
    if (platform === 'youtube') {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: googleClientId()!, client_secret: googleClientSecret()!,
          grant_type: 'refresh_token', refresh_token: refreshToken,
        }),
      })
      const d: any = await res.json()
      if (!res.ok || !d?.access_token) return null
      return { accessToken: d.access_token, refreshToken, expiresAt: expiry(d.expires_in), scope: d.scope ?? null, externalId: null }
    }
    // instagram (Instagram Login): extend the long-lived token (must be >24h old).
    const res = await fetch('https://graph.instagram.com/refresh_access_token?' + new URLSearchParams({
      grant_type: 'ig_refresh_token', access_token: refreshToken,
    }))
    const d: any = await res.json()
    if (!res.ok || !d?.access_token) return null
    return { accessToken: d.access_token, refreshToken: d.access_token, expiresAt: expiry(d.expires_in), scope: null, externalId: null }
  } catch (e: any) {
    console.error(`[oauth ${platform}] refresh failed:`, e?.message)
    return null
  }
}
