import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Saved campaigns are a creator feature (the mirror of brands saving creators).
// Free for every creator.
async function getOwnCreator() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, creator: null }
  const { data: account } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (account?.role !== 'creator') return { user, creator: null }
  const { data: creator } = await createAdminClient().from('creator_profiles')
    .select('id').eq('user_id', user.id).single()
  return { user, creator }
}

export async function GET() {
  const { user, creator } = await getOwnCreator()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!creator) return NextResponse.json({ error: 'Only creators can save campaigns' }, { status: 403 })

  const supabase = createClient()
  const { data, error } = await supabase.from('saved_campaigns')
    .select('campaign_id, created_at').eq('creator_id', creator.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { user, creator } = await getOwnCreator()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!creator) return NextResponse.json({ error: 'Only creators can save campaigns' }, { status: 403 })

  let body: { campaign_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.campaign_id) return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: campaign } = await admin.from('campaigns')
    .select('id').eq('id', body.campaign_id).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { error } = await admin.from('saved_campaigns')
    .insert({ creator_id: creator.id, campaign_id: body.campaign_id })
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not save campaign' }, { status: 500 })
  }
  return NextResponse.json({ saved: true })
}

export async function DELETE(req: NextRequest) {
  const { user, creator } = await getOwnCreator()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!creator) return NextResponse.json({ error: 'Only creators can save campaigns' }, { status: 403 })

  const campaignId = new URL(req.url).searchParams.get('campaign_id')
  if (!campaignId) return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('saved_campaigns')
    .delete().eq('creator_id', creator.id).eq('campaign_id', campaignId)
  if (error) return NextResponse.json({ error: 'Could not unsave campaign' }, { status: 500 })
  return NextResponse.json({ saved: false })
}
