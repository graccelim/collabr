import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

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

  const body = await req.json()
  const { submission_id, decision, feedback } = body // decision: 'approved' | 'revision'
  if (!submission_id) return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
  // Only approve or request-revision. A hard "reject" would strand the collab at
  // draft_submitted (the creator can't resubmit from there) — the brand path for
  // an unacceptable draft is to raise a dispute instead.
  if (!['approved', 'revision'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  if (decision === 'revision') {
    if (!feedback || feedback.length < 20) {
      return NextResponse.json({ error: 'Feedback must be at least 20 characters and specific to the brief' }, { status: 400 })
    }
  }

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const creatorEmail = (collab.creator_profiles as any)?.users?.email
  const admin = createAdminClient()

  const { data: result, error } = await admin.rpc('review_draft_atomic', {
    p_collab_id: params.id,
    p_submission_id: submission_id,
    p_decision: decision,
    p_feedback: feedback || '',
  }).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  const applied = (result as any)?.applied === true
  const submissionId = (result as any)?.submission_id

  if (decision === 'approved') {
    if (creatorUserId && applied) await sendNotification({ userId: creatorUserId, type: 'draft_approved',
      title: 'Draft approved, post live now!', payload: { collab_id: params.id },
      dedupeKey: `submission:${submissionId}:approved` })
    if (creatorEmail && applied) await sendProductEmail({ to: creatorEmail, ...productEmails.draftApproved({ collabId: params.id, key: String(submissionId) }) })

  } else if (decision === 'revision') {
    if (creatorUserId && applied) await sendNotification({ userId: creatorUserId, type: 'revision_requested',
      title: 'Revision requested', body: feedback, payload: { collab_id: params.id },
      dedupeKey: `submission:${submissionId}:revision` })
    if (creatorEmail && applied) await sendProductEmail({ to: creatorEmail, ...productEmails.revisionRequested({ collabId: params.id, key: String(submissionId) }) })
  }

  return NextResponse.json({ success: true, decision, applied })
}
