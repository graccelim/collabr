import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

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
  if (!['draft_approved', 'live_submitted'].includes(collab.status)) {
    return NextResponse.json({ error: 'Draft must be approved first' }, { status: 400 })
  }
  if (collab.payment_status !== 'funded') {
    return NextResponse.json({ error: 'Payment is no longer funded. Do not post live.' }, { status: 409 })
  }

  const body = await req.json()
  if (!body.post_url) return NextResponse.json({ error: 'Live post URL is required' }, { status: 400 })
  const autoReleaseAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  const admin = createAdminClient()

  const { data: result, error } = await admin.rpc('submit_live_post_atomic', {
    p_collab_id: params.id,
    p_post_url: body.post_url,
    p_screenshot_url: body.screenshot_url || '',
    p_auto_release_at: autoReleaseAt,
  }).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  const created = (result as any)?.created === true

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const brandEmail = (collab.brand_profiles as any)?.users?.email
  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Creator'

  if (brandUserId && created) await sendNotification({ userId: brandUserId, type: 'live_submitted',
    title: `${creatorName} posted live, confirm to release payment`, body: 'You have 72 hours',
    payload: { collab_id: params.id },
    dedupeKey: `collab:${params.id}:live-submitted` })
  if (brandEmail && created) await sendProductEmail({ to: brandEmail, ...productEmails.liveSubmitted({ creatorName, collabId: params.id }) })

  return NextResponse.json({
    success: true,
    created,
    live_post_id: (result as any)?.live_post_id,
    auto_release_at: created ? autoReleaseAt : collab.live_auto_release_at,
  })
}
