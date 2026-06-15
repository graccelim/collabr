import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { recomputeBrandRating, recomputeCreatorRating } from '@/lib/reputation'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['brand', 'creator'].includes(userRow?.role || '')) {
    return NextResponse.json({ error: 'Only collab parties can leave reviews' }, { status: 403 })
  }
  if (!body.collab_id || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: 'A valid collab and rating from 1 to 5 are required' }, { status: 400 })
  }

  const { data: collab } = await supabase.from('collabs')
    .select('status, payment_status, creator_profiles(user_id), brand_profiles(user_id)')
    .eq('id', body.collab_id)
    .single()
  if (!collab) return NextResponse.json({ error: 'Collab not found' }, { status: 404 })

  const isParty = userRow?.role === 'brand'
    ? (collab.brand_profiles as any)?.user_id === user.id
    : (collab.creator_profiles as any)?.user_id === user.id
  if (!isParty) return NextResponse.json({ error: 'Only collab parties can leave reviews' }, { status: 403 })
  if (collab.status !== 'completed' || !['paid', 'manual_exception'].includes(collab.payment_status)) {
    return NextResponse.json({ error: 'Reviews are available only after a paid collab is completed' }, { status: 409 })
  }

  const { data: existing } = await supabase.from('reviews')
    .select('id')
    .eq('collab_id', body.collab_id)
    .eq('reviewer_type', userRow?.role)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'You have already reviewed this collab' }, { status: 409 })

  const { data, error } = await supabase.from('reviews').insert({
    collab_id: body.collab_id,
    reviewer_id: user.id,
    reviewer_type: userRow?.role,
    rating: body.rating,
    note: body.note || null,
  }).select().single()

  if (error?.code === '23505') return NextResponse.json({ error: 'You have already reviewed this collab' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Event-triggered reputation refresh. Non-blocking — the nightly cron is the
  // backstop for both sides.
  const admin = createAdminClient()
  if (userRow?.role === 'brand') {
    // A brand review changes the creator's quality inputs + visible rating.
    const creatorUserId = (collab.creator_profiles as any)?.user_id
    if (creatorUserId) {
      const { data: cp } = await admin.from('creator_profiles').select('id').eq('user_id', creatorUserId).single()
      if (cp) {
        await admin.rpc('recompute_creator_scores', { p_creator_id: cp.id }).then(() => {}, () => {})
        await recomputeCreatorRating(admin, cp.id).catch(() => {})
      }
    }
  } else {
    // A creator review changes the brand's visible reputation.
    const { data: c } = await admin.from('collabs').select('brand_id').eq('id', body.collab_id).single()
    if (c?.brand_id) await recomputeBrandRating(admin, c.brand_id).catch(() => {})
  }
  return NextResponse.json(data, { status: 201 })
}
