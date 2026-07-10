import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { emails } from '@/lib/email'
import { checkRateLimitDurable, clientIp } from '@/lib/rate-limit'
import { ensureBrandSlug, ensureCreatorSlug } from '@/lib/slug-server'

// Minimal signup (2026-07 onboarding redesign): role + name + email + password
// is everything we ask for before the product. Niches, socials, industry and
// company details moved into the in-product onboarding checklist — they're
// collected AFTER email verification, where each unlocks something concrete.
// The transact gates are unchanged: applications/campaigns/invites still
// require email_confirmed_at AND onboarding_completed_at; this route just no
// longer sets the latter.
const signupSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(120),
  role: z.enum(['brand', 'creator']),
})

export async function POST(req: NextRequest) {
  // Anti-spam: 5 signups per hour per IP.
  if (!(await checkRateLimitDurable(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many signups. Try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }
  const { email, password, name, role } = parsed.data

  // Create auth user - SSR client sets session cookie on the response.
  // Supabase sends the confirmation email when "Confirm email" is enabled.
  // The token_hash email template's own ?next= controls the post-verification
  // redirect (see app/auth/confirm/route.ts); emailRedirectTo covers the
  // default ConfirmationURL template.
  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://joincollabr.com').replace(/\/+$/, '')
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: `${APP_URL}/dashboard` },
  })
  if (error) {
    // Supabase couldn't send the confirmation email (built-in email rate limit,
    // or no custom SMTP configured). Transient infrastructure, not bad input.
    if (/sending.*email|confirmation email/i.test(error.message)) {
      return NextResponse.json(
        { error: "We couldn't send your verification email right now. Please try again in a few minutes." },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data.user) {
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }

  // With email-enumeration protection, signing up an EXISTING address returns a
  // fake user whose identities array is empty. Without this check the users
  // insert below hits the unique-email constraint and the person sees a
  // meaningless "Could not create profile" — tell them to sign in instead.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return NextResponse.json(
      { error: 'This email is already registered. Sign in instead — or use "Forgot password" if you need access.' },
      { status: 409 }
    )
  }

  // With "Confirm email" enabled in Supabase, signUp returns no session - the
  // user must verify before logging in.
  const requiresEmailVerification = !data.session

  // Admin client bypasses RLS for the initial rows (the session cookie hasn't
  // been read back on this request yet).
  const admin = createAdminClient()
  const { error: userErr } = await admin.from('users').insert({
    id: data.user.id,
    role,
    email,
    display_name: name,
  })
  if (userErr) {
    console.error('[SIGNUP] users insert failed:', userErr)
    return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
  }

  // Bare profile row - onboarding_completed_at stays NULL until the checklist's
  // gate step is done (/api/onboarding/creator | /api/onboarding/brand).
  if (role === 'brand') {
    const { data: brand, error: brandErr } = await admin.from('brand_profiles').insert({
      user_id: data.user.id,
      company_name: name,
    }).select('id').single()
    if (brandErr || !brand) {
      console.error('[SIGNUP] brand profile insert failed:', brandErr)
      return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
    }
    await ensureBrandSlug(admin, brand.id, name)
    if (!requiresEmailVerification) emails.welcomeBrand(name, email).catch(e => console.error('[SIGNUP EMAIL]', e))
  } else {
    const { data: creator, error: creatorErr } = await admin.from('creator_profiles').insert({
      user_id: data.user.id,
    }).select('id').single()
    if (creatorErr || !creator) {
      console.error('[SIGNUP] creator profile insert failed:', creatorErr)
      return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
    }
    await ensureCreatorSlug(admin, creator.id, name)
    if (!requiresEmailVerification) emails.welcomeCreator(name, email).catch(e => console.error('[SIGNUP EMAIL]', e))
  }
  // When verification IS required, the welcome email is sent from /auth/confirm
  // after the link is clicked (the account becomes real at that moment).

  return NextResponse.json({ success: true, requiresEmailVerification })
}
