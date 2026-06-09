import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id, users(display_name)), brand_profiles(user_id, users(email))')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  if (creatorUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (collab.status !== 'draft_approved') return NextResponse.json({ error: 'Draft must be approved first' }, { status: 400 })

  const body = await req.json()
  const autoReleaseAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  await supabase.from('live_posts').insert({
    collab_id: params.id, post_url: body.post_url, screenshot_url: body.screenshot_url || null
  })
  await supabase.from('collabs').update({ status: 'live_submitted', live_auto_release_at: autoReleaseAt }).eq('id', params.id)

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const brandEmail = (collab.brand_profiles as any)?.users?.email
  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Creator'

  if (brandUserId) await sendNotification({ userId: brandUserId, type: 'live_submitted',
    title: `${creatorName} posted live — confirm to release payment`, body: 'You have 72 hours',
    payload: { collab_id: params.id } })
  if (brandEmail) await emails.liveSubmitted(brandEmail, creatorName, params.id)

  return NextResponse.json({ success: true, auto_release_at: autoReleaseAt })
}
