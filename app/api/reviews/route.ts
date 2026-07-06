import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { detectContactInfo } from '@/lib/moderation'

const MAX_NOTE = 1000

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = userRow?.role
  if (!['brand', 'creator'].includes(role || '')) {
    return NextResponse.json({ error: 'Only collab parties can leave reviews' }, { status: 403 })
  }
  if (!body.collab_id || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: 'A valid collab and rating from 1 to 5 are required' }, { status: 400 })
  }

  // ── Note: trim, cap, and keep it professional (reuse chat moderation) ──
  let note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > MAX_NOTE) {
    return NextResponse.json({ error: `Keep your note under ${MAX_NOTE} characters` }, { status: 400 })
  }
  if (note) {
    // Block contact details / off-platform solicitation; a bare @handle is fine.
    const reasons = detectContactInfo(note).reasons.filter(r => r !== 'social handle')
    if (reasons.length > 0) {
      return NextResponse.json(
        { error: 'Please remove contact details from your review, keep feedback about the work.' },
        { status: 400 }
      )
    }
  }

  const { data: collab } = await supabase.from('collabs')
    .select('status, payment_status, agreed_rate, creator_profiles(id, user_id), brand_profiles(id, user_id)')
    .eq('id', body.collab_id)
    .single()
  if (!collab) return NextResponse.json({ error: 'Collab not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const isParty = role === 'brand' ? brandUserId === user.id : creatorUserId === user.id
  if (!isParty) return NextResponse.json({ error: 'Only collab parties can leave reviews' }, { status: 403 })

  // Eligibility: a real COMPLETED collaboration. Paid collabs must have actually
  // settled; barter collabs (agreed_rate = 0) qualify on completion alone -
  // accountability doesn't require money to have changed hands.
  const settled = ['paid', 'manual_exception'].includes(collab.payment_status)
  const isBarter = (collab.agreed_rate ?? 0) === 0
  if (collab.status !== 'completed' || !(settled || isBarter)) {
    return NextResponse.json({ error: 'Reviews are available once the collaboration is completed' }, { status: 409 })
  }

  const { data, error } = await supabase.from('reviews').insert({
    collab_id: body.collab_id,
    reviewer_id: user.id,
    reviewer_type: role,
    rating: body.rating,
    note: note || null,
  }).select().single()

  if (error?.code === '23505') return NextResponse.json({ error: 'You have already reviewed this collab' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The DB trigger has already revealed both reviews + refreshed aggregates if
  // this was the second side. Here we only fire notifications (idempotent).
  const admin = createAdminClient()
  const { data: types } = await admin.from('reviews').select('reviewer_type').eq('collab_id', body.collab_id)
  const mutual = (types || []).length >= 2

  const counterpartyUserId = role === 'brand' ? creatorUserId : brandUserId
  try {
    if (mutual) {
      for (const uid of [brandUserId, creatorUserId].filter(Boolean)) {
        await sendNotification({
          userId: uid, type: 'review_revealed',
          title: 'Your collaboration review is now visible',
          body: 'You both reviewed, feedback is now revealed on both sides.',
          payload: { collab_id: body.collab_id },
          dedupeKey: `review_revealed:${body.collab_id}:${uid}`,
          email: false,
        })
      }
    } else if (counterpartyUserId) {
      await sendNotification({
        userId: counterpartyUserId, type: 'review_waiting',
        title: 'Feedback is waiting',
        body: 'Leave your review to unlock both sides.',
        payload: { collab_id: body.collab_id },
        dedupeKey: `review_waiting:${body.collab_id}:${counterpartyUserId}`,
        email: false,
      })
    }
    // Email the counterparty that they received a review (both cases).
    if (counterpartyUserId) {
      await sendProductEmail({ userId: counterpartyUserId, ...productEmails.reviewReceived({ collabId: body.collab_id, recipientId: counterpartyUserId }) })
    }
  } catch { /* notifications never block a review */ }

  // A brand review also feeds the creator's internal ranking inputs (separate
  // from the visible rating, which the trigger handles).
  if (role === 'brand') {
    const cpId = (collab.creator_profiles as any)?.id
    if (cpId) await admin.rpc('recompute_creator_scores', { p_creator_id: cpId }).then(() => {}, () => {})
  }

  return NextResponse.json(data, { status: 201 })
}
