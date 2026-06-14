import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { creatorProfileUpdateSchema, firstZodError } from '@/lib/profiles'

const SELECT_COLUMNS =
  'id, user_id, bio, niche, niches, location, portfolio_links, media_kit_url, ' +
  'average_rate_sgd, availability_status, base_rate, is_verified, boost_active_until, ' +
  'rating_avg, rating_count, collabs_completed, total_earned, onboarding_completed_at, created_at'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator') return NextResponse.json({ error: 'Creator only' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = creatorProfileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
  }

  const { display_name, ...fields } = parsed.data
  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) updates[k] = v
  }
  // Keep the legacy base_rate column in sync so pages still reading it
  // (e.g. the discovery list) stay accurate until they migrate.
  if (updates.average_rate_sgd !== undefined) {
    updates.base_rate = updates.average_rate_sgd ?? 0
  }
  // Keep the multi-niche tags in sync with the primary niche (canonical slug).
  if (updates.niche !== undefined && updates.niche) {
    updates.niche_tags = [updates.niche]
  }

  if (Object.keys(updates).length === 0 && !display_name) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  let data = null
  if (Object.keys(updates).length > 0) {
    const result = await supabase.from('creator_profiles')
      .update(updates).eq('user_id', user.id)
      .select(SELECT_COLUMNS)
      .single()
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    data = result.data
  } else {
    const result = await supabase.from('creator_profiles')
      .select(SELECT_COLUMNS).eq('user_id', user.id).single()
    data = result.data
  }

  if (display_name) {
    await supabase.from('users').update({ display_name }).eq('id', user.id)
  }

  return NextResponse.json(data)
}
