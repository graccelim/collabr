import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  await supabase.auth.signOut()
  // 303 See Other: the default 307 preserves the POST method, so the browser
  // would re-POST to /login (a GET-only page route) and get a 405. The origin
  // comes from the request so every deployment URL redirects to itself.
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 })
}
