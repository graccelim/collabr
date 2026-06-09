import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, boost_active_until').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  const body = await req.json()
  const isBoosted = creator.boost_active_until && new Date(creator.boost_active_until) > new Date()

  const { data, error } = await supabase.from('applications').insert({
    campaign_id: body.campaign_id,
    creator_id: creator.id,
    pitch: body.pitch,
    proposed_rate: body.proposed_rate || null,
    is_boosted: !!isBoosted,
  }).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already applied' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify brand
  const { data: campaign } = await supabase.from('campaigns')
    .select('brand_profiles(user_id)').eq('id', body.campaign_id).single()
  const brandUserId = (campaign?.brand_profiles as any)?.user_id
  if (brandUserId) {
    await sendNotification({
      userId: brandUserId,
      type: 'new_application',
      title: 'New application received',
      body: `A creator applied to your campaign`,
      payload: { application_id: data.id }
    })
  }

  return NextResponse.json(data, { status: 201 })
}
