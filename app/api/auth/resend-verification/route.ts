import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimitDurable, clientIp } from '@/lib/rate-limit'
import { z } from 'zod'

// Resends the Supabase confirmation email. Works BOTH signed-in (TrustBanners
// button) and signed-out with an email in the body — an unverified user can't
// log in, so an expired link must be recoverable without a session.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Signed-in path: resend to the session's own address.
  if (user?.email) {
    if (user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email is already verified' }, { status: 400 })
    }
    if (!(await checkRateLimitDurable(`resend-verification:${user.id}`, 3, 60 * 60 * 1000))) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  // Signed-out path (expired link → /login banner). Rate-limited per IP and
  // per email; the response never reveals whether the address exists.
  const body = await req.json().catch(() => ({}))
  const parsed = z.object({ email: z.string().trim().email().max(255) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  const email = parsed.data.email.toLowerCase()
  const ipOk = await checkRateLimitDurable(`resend-verification:ip:${clientIp(req)}`, 5, 60 * 60 * 1000)
  const emailOk = await checkRateLimitDurable(`resend-verification:email:${email}`, 3, 60 * 60 * 1000)
  if (!ipOk || !emailOk) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }
  // Best-effort; suppress the result so this can't be used to probe accounts.
  await supabase.auth.resend({ type: 'signup', email }).catch(() => {})
  return NextResponse.json({ success: true })
}
