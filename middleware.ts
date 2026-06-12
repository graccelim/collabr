import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PREFIXES = [
  '/dashboard', '/collabs', '/campaigns', '/jobs', '/profile',
  '/earnings', '/boost', '/billing', '/notifications', '/settings',
  '/applications', '/creators', '/post-job', '/admin', '/onboarding', '/invites',
]

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

  // Always call getUser() — this refreshes the session token and writes updated cookies
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  )

  if (isProtected && !user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
