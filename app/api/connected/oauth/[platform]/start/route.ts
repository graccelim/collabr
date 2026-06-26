import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { flags } from '@/lib/flags'
import { authorizeUrl, oauthConfigured, type OAuthPlatform } from '@/lib/analytics/oauth'
import { isCreatorProActive } from '@/lib/creator-pro'

const OAUTH_PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const

// Begins a first-party OAuth connect. Pro-gated. Sets a short-lived CSRF state
// cookie, then redirects to the platform's consent screen.
export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const platform = params.platform as OAuthPlatform
  if (!OAUTH_PLATFORMS.includes(platform) || !oauthConfigured(platform)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.redirect(new URL('/studio', req.url))
  if (!(await isCreatorProActive(admin, creator.id))) {
    return NextResponse.redirect(new URL('/studio?connect=pro_required', req.url))
  }

  const state = crypto.randomUUID()
  const url = authorizeUrl(platform, state)
  if (!url) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const res = NextResponse.redirect(url)
  res.cookies.set(`cl_oauth_${platform}`, state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  })
  return res
}
