import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { safeNextPath } from '@/lib/nav'
import { createAdminClient } from '@/lib/supabase/server'
import { emails } from '@/lib/email'

// Send the welcome email once, the first time a signup link is confirmed.
async function sendWelcomeOnConfirm(userId: string) {
  try {
    const admin = createAdminClient()
    const { data: u } = await admin.from('users').select('role, display_name, email').eq('id', userId).single()
    if (!u?.email) return
    const name = u.display_name || u.email.split('@')[0] || 'there'
    if (u.role === 'brand') await emails.welcomeBrand(name, u.email)
    else await emails.welcomeCreator(name, u.email)
  } catch (e) {
    console.error('[CONFIRM WELCOME]', e)
  }
}

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
    // Fresh-from-verification marker: the dashboard's onboarding checklist can
    // greet the arrival ("You're verified"). Harmless anywhere else.
    if (type === 'signup') dest.searchParams.set('welcome', '1')
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
    if (!error) {
      // Email is now confirmed → the account is real → send the welcome email.
      if (type === 'signup') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await sendWelcomeOnConfirm(user.id)
      }
      return res
    }
  }

  // Bad/expired/missing token → send to a clear recovery entry point.
  const dest = type === 'recovery' ? '/reset-password?error=expired' : '/login?error=link_expired'
  return NextResponse.redirect(new URL(dest, origin))
}
