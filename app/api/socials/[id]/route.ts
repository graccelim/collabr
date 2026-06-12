import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  follower_count: z.number().int().min(0).max(1_000_000_000).nullish(),
  is_primary: z.literal(true).optional(),
})

async function getOwnedAccount(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, creator: null, account: null }
  const { data: creator } = await supabase.from('creator_profiles')
    .select('id').eq('user_id', user.id).single()
  if (!creator) return { user, creator: null, account: null }
  const admin = createAdminClient()
  const { data: account } = await admin.from('social_accounts')
    .select('id, creator_id').eq('id', id).eq('creator_id', creator.id).maybeSingle()
  return { user, creator, account }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, creator, account } = await getOwnedAccount(params.id)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!creator || !account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (parsed.data.is_primary) {
    // Demote the current primary first to satisfy the partial unique index.
    await admin.from('social_accounts')
      .update({ is_primary: false }).eq('creator_id', creator.id).eq('is_primary', true)
  }

  const updates: Record<string, unknown> = {}
  if ('follower_count' in (body as object)) updates.follower_count = parsed.data.follower_count ?? null
  if (parsed.data.is_primary) updates.is_primary = true
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await admin.from('social_accounts')
    .update(updates).eq('id', account.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, creator, account } = await getOwnedAccount(params.id)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!creator || !account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()

  // Onboarding requires at least one connected social account.
  const { count } = await admin.from('social_accounts')
    .select('*', { count: 'exact', head: true }).eq('creator_id', creator.id)
  if ((count || 0) <= 1) {
    return NextResponse.json(
      { error: 'At least one social account is required' },
      { status: 400 }
    )
  }

  const { error } = await admin.from('social_accounts').delete().eq('id', account.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep a primary account if the primary was removed.
  const { data: primary } = await admin.from('social_accounts')
    .select('id').eq('creator_id', creator.id).eq('is_primary', true).maybeSingle()
  if (!primary) {
    const { data: next } = await admin.from('social_accounts')
      .select('id').eq('creator_id', creator.id).order('created_at').limit(1).maybeSingle()
    if (next) await admin.from('social_accounts').update({ is_primary: true }).eq('id', next.id)
  }

  return NextResponse.json({ success: true })
}
