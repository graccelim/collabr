import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { emails } from '@/lib/email'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import {
  brandOnboardingFields, creatorOnboardingSchema, requireWebsiteOrSocial, socialUrl,
} from '@/lib/onboarding'
import { brandSocialSchema } from '@/lib/profiles'

const baseSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(120),
  role: z.enum(['brand', 'creator']),
})

const creatorSignupSchema = baseSchema.extend({
  role: z.literal('creator'),
}).and(creatorOnboardingSchema)

// The brand's `name` field doubles as the company name at signup.
const brandSignupSchema = baseSchema.extend({
  role: z.literal('brand'),
}).and(
  brandOnboardingFields.omit({ company_name: true }).extend({
    company_description: z.string().trim().max(2000).optional().nullable(),
    location: z.string().trim().max(120).optional().nullable(),
    socials: z.array(brandSocialSchema).max(6).optional(),
  }).refine(requireWebsiteOrSocial, {
    message: 'A website or a social account link is required',
    path: ['website'],
  })
)

export async function POST(req: NextRequest) {
  // Anti-spam: 5 signups per hour per IP (lightweight, per-instance).
  if (!checkRateLimit(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many signups. Try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const role = (body as { role?: string })?.role
  if (role !== 'brand' && role !== 'creator') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const parsed = role === 'creator'
    ? creatorSignupSchema.safeParse(body)
    : brandSignupSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Pre-check social handle availability so we fail before creating the auth
  // user. The unique index still backstops races.
  if (parsed.data.role === 'creator') {
    const socials = parsed.data.socials
    const seen = new Set<string>()
    for (const s of socials) {
      const key = `${s.platform}:${s.handle}`
      if (seen.has(key)) {
        return NextResponse.json({ error: `Duplicate handle @${s.handle} on ${s.platform}` }, { status: 400 })
      }
      seen.add(key)
    }
    for (const s of socials) {
      const { data: taken } = await admin.from('social_accounts')
        .select('id').eq('platform', s.platform).eq('handle', s.handle).maybeSingle()
      if (taken) {
        return NextResponse.json(
          { error: `@${s.handle} on ${s.platform} is already connected to another account` },
          { status: 409 }
        )
      }
    }
  }

  // Create auth user - SSR client sets session cookie on the response.
  // Supabase sends the confirmation email when "Confirm email" is enabled.
  const { email, password, name } = parsed.data
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data.user) {
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }

  // With "Confirm email" enabled in Supabase, signUp returns no session - the
  // user must verify before logging in.
  const requiresEmailVerification = !data.session

  // Use admin client to bypass RLS for the initial row inserts
  // (the session cookie hasn't been read back on this request yet)
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

  if (parsed.data.role === 'brand') {
    const { error: brandErr } = await admin.from('brand_profiles').insert({
      user_id: data.user.id,
      company_name: name,
      industry: parsed.data.industry,
      company_description: parsed.data.company_description || null,
      website: parsed.data.website || null,
      social_url: parsed.data.social_url || null,
      onboarding_completed_at: new Date().toISOString(),
    })
    if (brandErr) {
      console.error('[SIGNUP] brand profile insert failed:', brandErr)
      return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
    }
    // `location` (020) and `socials` (021) are newer columns - set them
    // best-effort and separately so signup never fails on DBs where one of the
    // columns isn't applied yet.
    if (parsed.data.location) {
      await admin.from('brand_profiles').update({ location: parsed.data.location }).eq('user_id', data.user.id)
    }
    if (parsed.data.socials && parsed.data.socials.length > 0) {
      await admin.from('brand_profiles').update({ socials: parsed.data.socials }).eq('user_id', data.user.id)
    }
    // Fire-and-forget - don't block the response on email delivery
    emails.welcomeBrand(name, email).catch(e => console.error('[SIGNUP EMAIL]', e))
  } else {
    const { data: creator, error: creatorErr } = await admin.from('creator_profiles').insert({
      user_id: data.user.id,
      niche: parsed.data.niche ?? parsed.data.niche_tags[0],
      niche_tags: parsed.data.niche_tags,
    }).select('id').single()
    if (creatorErr || !creator) {
      console.error('[SIGNUP] creator profile insert failed:', creatorErr)
      return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
    }

    const { error: socialErr } = await admin.from('social_accounts').insert(
      parsed.data.socials.map((s, i) => ({
        creator_id: creator.id,
        platform: s.platform,
        handle: s.handle,
        url: socialUrl(s.platform, s.handle),
        follower_count: s.follower_count ?? null,
        is_primary: i === 0,
      }))
    )
    if (socialErr) {
      // Account exists but onboarding is incomplete - the user finishes it at
      // /onboarding. Surface the duplicate-handle case clearly.
      console.error('[SIGNUP] social insert failed:', socialErr)
      const msg = socialErr.code === '23505'
        ? 'A social handle was just taken, finish onboarding from your dashboard'
        : 'Could not save social accounts, finish onboarding from your dashboard'
      return NextResponse.json({ success: true, warning: msg, requiresEmailVerification })
    }

    await admin.from('creator_profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', creator.id)

    emails.welcomeCreator(name, email).catch(e => console.error('[SIGNUP EMAIL]', e))
  }

  return NextResponse.json({ success: true, requiresEmailVerification })
}
