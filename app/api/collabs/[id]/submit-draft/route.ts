import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id, users(display_name, email)), brand_profiles(user_id, users(email))')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Collab not found' }, { status: 404 })

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  if (creatorUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!['briefed','in_revision','draft_approved'].includes(collab.status) &&
      collab.status !== 'briefed' && collab.status !== 'in_revision') {
    return NextResponse.json({ error: 'Cannot submit draft at this stage' }, { status: 400 })
  }

  const body = await req.json()
  const autoApproveAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  // Create submission record
  const { data: lastSub } = await supabase.from('submissions')
    .select('version').eq('collab_id', params.id).order('version', { ascending: false }).limit(1).single()
  const version = (lastSub?.version || 0) + 1

  await supabase.from('submissions').insert({
    collab_id: params.id,
    version,
    file_url: body.file_url,
    creator_note: body.creator_note || null,
  })

  // Update collab status
  await supabase.from('collabs').update({
    status: 'draft_submitted',
    draft_auto_approve_at: autoApproveAt,
  }).eq('id', params.id)

  // Notify brand
  const brandUserId = (collab.brand_profiles as any)?.user_id
  const brandEmail = (collab.brand_profiles as any)?.users?.email
  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Creator'

  if (brandUserId) {
    await sendNotification({ userId: brandUserId, type: 'draft_submitted',
      title: `Draft submitted by ${creatorName}`, body: 'Review it within 48 hours',
      payload: { collab_id: params.id } })
  }
  if (brandEmail) await emails.draftSubmitted(brandEmail, creatorName, params.id)

  return NextResponse.json({ success: true, auto_approve_at: autoApproveAt })
}
