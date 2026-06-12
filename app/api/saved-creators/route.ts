import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolvePlan, proGateResponse, PLAN_COLUMNS } from '@/lib/plans'

async function getOwnBrand() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, brand: null, gate: null }
  const { data: account } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (account?.role !== 'brand') return { user, brand: null, gate: null }
  // Admin client: subscription columns are server-only; own row by user_id.
  const { data: brand } = await createAdminClient().from('brand_profiles')
    .select(`id, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
  // Pro feature (complimentary for every brand while in beta).
  const gate = brand ? proGateResponse(resolvePlan(brand), 'Saved creators') : null
  return { user, brand, gate }
}

export async function GET() {
  const { user, brand, gate } = await getOwnBrand()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!brand) return NextResponse.json({ error: 'Only brands can save creators' }, { status: 403 })
  if (gate) return gate

  const supabase = createClient()
  const { data, error } = await supabase.from('saved_creators')
    .select('creator_id, created_at').eq('brand_id', brand.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { user, brand, gate } = await getOwnBrand()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!brand) return NextResponse.json({ error: 'Only brands can save creators' }, { status: 403 })
  if (gate) return gate

  let body: { creator_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.creator_id) return NextResponse.json({ error: 'creator_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles')
    .select('id').eq('id', body.creator_id).maybeSingle()
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

  const { error } = await admin.from('saved_creators')
    .insert({ brand_id: brand.id, creator_id: body.creator_id })
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not save creator' }, { status: 500 })
  }
  return NextResponse.json({ saved: true })
}

export async function DELETE(req: NextRequest) {
  const { user, brand, gate } = await getOwnBrand()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!brand) return NextResponse.json({ error: 'Only brands can save creators' }, { status: 403 })
  if (gate) return gate

  const creatorId = new URL(req.url).searchParams.get('creator_id')
  if (!creatorId) return NextResponse.json({ error: 'creator_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('saved_creators')
    .delete().eq('brand_id', brand.id).eq('creator_id', creatorId)
  if (error) return NextResponse.json({ error: 'Could not unsave creator' }, { status: 500 })
  return NextResponse.json({ saved: false })
}
