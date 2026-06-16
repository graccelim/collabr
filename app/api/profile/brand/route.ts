import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { brandProfileUpdateSchema, firstZodError } from '@/lib/profiles'

const SELECT_COLUMNS =
  'id, user_id, company_name, company_description, industry, website, social_url, ' +
  'logo_url, plan, completed_campaigns, onboarding_completed_at, created_at'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'brand') return NextResponse.json({ error: 'Brand only' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = brandProfileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 })
  }

  const { display_name, ...fields } = parsed.data
  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) updates[k] = v
  }
  // company_name has a not-null default - never blank it out.
  if (updates.company_name === null) delete updates.company_name

  if (Object.keys(updates).length === 0 && !display_name) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  let data = null
  if (Object.keys(updates).length > 0) {
    let result = await supabase.from('brand_profiles')
      .update(updates).eq('user_id', user.id)
      .select(SELECT_COLUMNS)
      .single()
    // `location` (020) and `socials` (021) are newer columns. On DBs where they
    // aren't applied yet the update errors - retry without them so the rest of
    // the save still lands.
    if (result.error && ('location' in updates || 'socials' in updates)) {
      const rest = { ...updates }
      delete rest.location
      delete rest.socials
      result = Object.keys(rest).length > 0
        ? await supabase.from('brand_profiles').update(rest).eq('user_id', user.id).select(SELECT_COLUMNS).single()
        : await supabase.from('brand_profiles').select(SELECT_COLUMNS).eq('user_id', user.id).single()
    }
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    data = result.data
  } else {
    const result = await supabase.from('brand_profiles')
      .select(SELECT_COLUMNS).eq('user_id', user.id).single()
    data = result.data
  }

  if (display_name) {
    await supabase.from('users').update({ display_name }).eq('id', user.id)
  }

  return NextResponse.json(data)
}
