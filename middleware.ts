import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PREFIXES = [
  '/dashboard', '/collabs', '/campaigns', '/jobs', '/profile',
  '/earnings', '/boost', '/billing', '/notifications', '/settings',
  '/applications', '/creators', '/post-job', '/admin', '/onboarding', '/invites',
  '/saved',
]

// Public detail pages: a creator/brand profile or a campaign, viewable while
// logged out (SEO + shareable links). These are SUB-PATHS only - the bare list
// routes (/creators, /jobs) stay gated, but /creators/<slug>, /jobs/<slug> and
// /brands/<slug> are open. Listed with a trailing slash so the exact list route
// (e.g. "/creators") never matches.
const PUBLIC_DETAIL_PREFIXES = ['/creators/', '/jobs/', '/brands/']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always create a response so we can forward refreshed session cookies
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) =>
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options as any)),
      },
    }
  )

  // Always call getUser() - this refreshes the session token and writes updated cookies
  const { data: { user } } = await supabase.auth.getUser()

  // A signed-in user has no business on /login or /signup — send them into the
  // app. This is what makes the verification link feel like auto-login even if
  // the Supabase email template still points its ?next= at /login: /auth/confirm
  // sets the session cookie on its redirect, and this bounce completes the trip.
  // (/reset-password is deliberately NOT included: recovery sessions must stay
  // on the reset page.)
  if ((pathname === '/login' || pathname === '/signup') && user) {
    const redirect = NextResponse.redirect(new URL('/dashboard', req.url))
    res.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    redirect.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
    return redirect
  }

  // Logged-in users never see the public marketing page — bounce them into the
  // app here (not in the page) so the landing stays statically rendered.
  if (pathname === '/' && user) {
    const redirect = NextResponse.redirect(new URL('/dashboard', req.url))
    // carry any refreshed session cookies forward on the redirect
    res.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    redirect.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
    return redirect
  }

  // A public detail page wins over the protected-prefix match (e.g. "/creators/"
  // beats the "/creators" gate), so logged-out visitors are never redirected.
  const isPublicDetail = PUBLIC_DETAIL_PREFIXES.some(prefix =>
    pathname.startsWith(prefix)
  )
  const isProtected = !isPublicDetail && PROTECTED_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  )

  if (isProtected && !user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(loginUrl)
    redirect.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
    return redirect
  }

  // Authenticated pages must never be served from the browser's back/forward
  // cache: after sign-out, pressing Back would otherwise show the previous
  // account's page without re-running this middleware. `no-store` makes the page
  // bfcache-ineligible, so Back re-requests it and an unauthenticated user is
  // bounced to /login.
  if (isProtected) {
    res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
