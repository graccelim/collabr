import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { safeNextPath } from '@/lib/nav'

/**
 * Server-side email link handler (Supabase SSR token_hash flow).
 *
 * Email templates point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/login
 *
 * Unlike the PKCE `?code` flow, verifyOtp({ token_hash }) needs no device-bound
 * code verifier, so the link works even when opened on a different device/app
 * than where it was requested. We set the session cookie on the redirect and
 * send the user on to `next`.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'), '/dashboard')

  if (token_hash && type) {
    const cookieStore = cookies()
    // For recovery, signal the reset page that THIS session was just established
    // by the recovery token (so it never resets a pre-existing, different account).
    const dest = new URL(next, origin)
    if (type === 'recovery') dest.searchParams.set('verified', '1')
    const res = NextResponse.redirect(dest)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) =>
            toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options as never)),
        },
      }
    )
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return res
  }

  // Bad/expired/missing token → send to a clear recovery entry point.
  const dest = type === 'recovery' ? '/reset-password?error=expired' : '/login?error=link_expired'
  return NextResponse.redirect(new URL(dest, origin))
}
