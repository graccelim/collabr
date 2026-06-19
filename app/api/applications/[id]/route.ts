import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { notifyCollabFunded } from '@/lib/collab-funding'
import { computeFee } from '@/lib/utils'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await req.json()
  // 'pending' is allowed as a target only to support "Remove from shortlist"
  // (shortlisted → pending); see the guarded update below.
  if (!['pending', 'shortlisted', 'selected', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Load application with campaign and brand ownership check
  const { data: application } = await supabase.from('applications')
    .select('*, campaigns(id, brand_id, title, comp_type, creators_needed, brand_profiles(user_id, plan)), creator_profiles(id, user_id, users(display_name, email))')
    .eq('id', params.id).single()
  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (application.campaigns as any)?.brand_profiles?.user_id
  if (brandUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const creatorUserId = (application.creator_profiles as any)?.user_id
  const creatorId = (application.creator_profiles as any)?.id
  const creatorEmail = (application.creator_profiles as any)?.users?.email
  const campaignTitle = (application.campaigns as any)?.title || 'a campaign'

  let collabId: string | undefined
  let changed = false
  const admin = createAdminClient()

  if (status === 'selected') {
    if (!creatorUserId || !creatorId) {
      return NextResponse.json({ error: 'Creator profile is incomplete; selection cannot create a collab.' }, { status: 409 })
    }
    const plan: 'free' | 'pro' = (application.campaigns as any)?.brand_profiles?.plan || 'free'
    const compType = (application.campaigns as any)?.comp_type
    const agreedRate = application.proposed_rate
    const isBarterDeal = !agreedRate || agreedRate <= 0

    if (isBarterDeal) {
      // True barter: no cash, no escrow. Allowed only on barter/both campaigns.
      if (compType !== 'barter' && compType !== 'both') {
        return NextResponse.json({ error: 'A positive agreed rate is required to accept this applicant.' }, { status: 400 })
      }
      const { data: selection, error: barterErr } = await admin.rpc('select_barter_collab', {
        p_application_id: params.id,
      }).single()
      if (barterErr) {
        console.error('[BARTER COLLAB CREATE]', barterErr)
        return NextResponse.json({ error: barterErr.message }, { status: 409 })
      }
      collabId = (selection as any)?.collab_id
      changed = (selection as any)?.created === true
      // Barter is committed at accept (there's no funding step), so confirm the
      // creator + auto-reject leftovers now — same as the funded path does.
      if (changed && collabId) {
        try { await notifyCollabFunded(admin, collabId) } catch (e) { console.error('[BARTER NOTIFY]', e) }
      }
    } else {
      const { fee, payout } = computeFee(agreedRate, plan)
      const { data: selection, error: collabErr } = await admin.rpc('select_application_atomic', {
        p_application_id: params.id,
        p_agreed_rate: agreedRate,
        p_platform_fee: fee,
        p_creator_payout: payout,
      }).single()
      if (collabErr) {
        console.error('[COLLAB CREATE]', collabErr)
        return NextResponse.json({ error: collabErr.message }, { status: 409 })
      }
      collabId = (selection as any)?.collab_id
      changed = (selection as any)?.created === true
      // Paid: the creator is NOT notified here — selection alone isn't a
      // commitment. The "Confirmed · payment secured" notification + leftover
      // auto-reject fire once escrow funds (webhook → notifyCollabFunded).
    }
  } else {
    const { data: updated, error } = await admin.from('applications')
      .update({ status })
      .eq('id', params.id)
      .in('status', ['pending', 'shortlisted'])
      .neq('status', status)
      .select('id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    changed = Boolean(updated)
    if (!changed && application.status !== status) {
      return NextResponse.json({ error: `Application cannot move from ${application.status} to ${status}` }, { status: 409 })
    }
  }

  // "Save" (status=shortlisted) is a PRIVATE brand-side bookmark - intentionally
  // no creator notification, so it never raises false hope. Only Pass/Accept ping.
  if (status === 'rejected' && creatorUserId && changed) {
    await sendNotification({
      userId: creatorUserId,
      type: 'application_rejected',
      title: `Application not selected for "${campaignTitle}"`,
      body: 'The brand went in another direction. New campaigns are posted regularly, keep applying.',
      payload: { application_id: params.id },
      dedupeKey: `application:${params.id}:rejected`,
    })
    await sendProductEmail({ to: creatorEmail, ...productEmails.applicationRejected({ campaignTitle, applicationId: params.id }) })
  }

  return NextResponse.json({ success: true, status, changed, ...(collabId ? { collab_id: collabId } : {}) })
}
