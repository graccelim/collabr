import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { emails } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id, users(email)), brand_profiles(user_id)')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  if (brandUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (collab.status !== 'draft_submitted') return NextResponse.json({ error: 'No draft pending review' }, { status: 400 })
  if (collab.payment_status !== 'funded') {
    return NextResponse.json({ error: 'Payment is no longer funded. Draft review is paused.' }, { status: 409 })
  }

  const body = await req.json()
  const { decision, feedback } = body // decision: 'approved' | 'revision' | 'rejected'

  if (decision === 'revision' || decision === 'rejected') {
    if (!feedback || feedback.length < 20) {
      return NextResponse.json({ error: 'Feedback must be at least 20 characters and specific to the brief' }, { status: 400 })
    }
  }

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const creatorEmail = (collab.creator_profiles as any)?.users?.email
  const admin = createAdminClient()

  if (decision === 'approved') {
    await admin.from('collabs').update({ status: 'draft_approved', draft_auto_approve_at: null }).eq('id', params.id)
    await admin.from('submissions').update({ decision: 'approved', decided_at: new Date().toISOString() })
      .eq('collab_id', params.id).eq('decision', 'pending')
    if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'draft_approved',
      title: 'Draft approved — post live now!', payload: { collab_id: params.id } })
    if (creatorEmail) await emails.draftApproved(creatorEmail, params.id)

  } else if (decision === 'revision') {
    if (collab.revision_count >= 2) {
      return NextResponse.json({ error: 'Max 2 revision rounds included. This would be a scope change — creator must agree first.' }, { status: 400 })
    }
    await admin.from('collabs').update({
      status: 'in_revision', revision_count: collab.revision_count + 1, draft_auto_approve_at: null
    }).eq('id', params.id)
    await admin.from('submissions').update({ decision: 'revision', brand_feedback: feedback, decided_at: new Date().toISOString() })
      .eq('collab_id', params.id).eq('decision', 'pending')
    if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'revision_requested',
      title: 'Revision requested', body: feedback, payload: { collab_id: params.id } })
    if (creatorEmail) await emails.revisionRequested(creatorEmail, params.id)

  } else if (decision === 'rejected') {
    await admin.from('collabs').update({ status: 'draft_submitted' }).eq('id', params.id) // stays, creator can dispute
    await admin.from('submissions').update({ decision: 'rejected', brand_feedback: feedback, decided_at: new Date().toISOString() })
      .eq('collab_id', params.id).eq('decision', 'pending')
    if (creatorUserId) await sendNotification({ userId: creatorUserId, type: 'draft_rejected',
      title: 'Draft rejected', body: feedback, payload: { collab_id: params.id } })
  }

  return NextResponse.json({ success: true, decision })
}
