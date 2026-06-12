import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { creatorOnboardingSchema, socialUrl } from '@/lib/onboarding'

// Completes onboarding for an existing creator account: sets the niche and
// connects at least one social account, then marks onboarding complete.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, onboarding_completed_at').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = creatorOnboardingSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Connect socials the creator doesn't already have. Handles owned by other
  // creators are rejected (duplicate-handle prevention).
  const { data: existing } = await admin.from('social_accounts')
    .select('id, platform, handle, creator_id')
    .in('handle', parsed.data.socials.map(s => s.handle))
  for (const s of parsed.data.socials) {
    const match = existing?.find(e => e.platform === s.platform && e.handle === s.handle)
    if (match && match.creator_id !== creator.id) {
      return NextResponse.json(
        { error: `@${s.handle} on ${s.platform} is already connected to another account` },
        { status: 409 }
      )
    }
  }

  const { data: hasPrimary } = await admin.from('social_accounts')
    .select('id').eq('creator_id', creator.id).eq('is_primary', true).maybeSingle()

  let primaryAssigned = Boolean(hasPrimary)
  for (const s of parsed.data.socials) {
    const already = existing?.find(e => e.platform === s.platform && e.handle === s.handle)
    if (already) continue
    const { error } = await admin.from('social_accounts').insert({
      creator_id: creator.id,
      platform: s.platform,
      handle: s.handle,
      url: socialUrl(s.platform, s.handle),
      follower_count: s.follower_count ?? null,
      is_primary: !primaryAssigned,
    })
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `@${s.handle} on ${s.platform} is already connected to another account` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    primaryAssigned = true
  }

  const { error: updateErr } = await admin.from('creator_profiles').update({
    niche: parsed.data.niche,
    onboarding_completed_at: creator.onboarding_completed_at || new Date().toISOString(),
  }).eq('id', creator.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
