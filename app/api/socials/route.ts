import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { socialAccountInputSchema, socialUrl } from '@/lib/onboarding'
import { checkRateLimitDurable } from '@/lib/rate-limit'

async function getOwnCreator(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, creator: null }
  const { data: creator } = await supabase.from('creator_profiles')
    .select('id').eq('user_id', user.id).single()
  return { user, creator }
}

export async function GET() {
  const supabase = createClient()
  const { user, creator } = await getOwnCreator(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  // Read via the service role: verification_code is no longer client-readable
  // (migration 017), but the OWNER may see their own pending code here since the
  // query is scoped to their own creator.id.
  const { data, error } = await createAdminClient().from('social_accounts')
    .select('*').eq('creator_id', creator.id)
    .order('is_primary', { ascending: false }).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { user, creator } = await getOwnCreator(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  // Anti-spam: cap how fast accounts can be added.
  if (!(await checkRateLimitDurable(`socials:${user.id}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many changes. Try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = socialAccountInputSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue?.message || 'Invalid input' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { count } = await admin.from('social_accounts')
    .select('*', { count: 'exact', head: true }).eq('creator_id', creator.id)

  const { data, error } = await admin.from('social_accounts').insert({
    creator_id: creator.id,
    platform: parsed.data.platform,
    handle: parsed.data.handle,
    url: socialUrl(parsed.data.platform, parsed.data.handle),
    follower_count: parsed.data.follower_count ?? null,
    is_primary: (count || 0) === 0, // first account becomes primary
  }).select().single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `@${parsed.data.handle} on ${parsed.data.platform} is already connected to another account` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
