import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { notifyCollabFunded } from '@/lib/collab-funding'
import { capacityBreakdown } from '@/lib/collab-status'
import { computeFee } from '@/lib/utils'
import { isCreatorProActive } from '@/lib/creator-pro'

// Turn a raw "capacity reached" RPC error into a brand-clear message that names
// the real cause when reserved (selected-but-unfunded) slots are what's full.
async function capacityErrorMessage(
  admin: ReturnType<typeof createAdminClient>,
  campaignId: string,
  creatorsNeeded: number | null | undefined,
  rawMessage: string,
): Promise<string> {
  if (!/capacity/i.test(rawMessage)) return rawMessage
  const { data: collabs } = await admin.from('collabs')
    .select('status, payment_status').eq('campaign_id', campaignId)
  const cap = capacityBreakdown(creatorsNeeded, collabs || [])
  if (cap.available <= 0 && cap.awaiting > 0) {
    return 'This campaign has no available slots because selected creators are awaiting payment.'
  }
  return 'This campaign has already filled all its creator slots.'
}

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
        const msg = await capacityErrorMessage(admin, (application.campaigns as any)?.id, (application.campaigns as any)?.creators_needed, barterErr.message)
        return NextResponse.json({ error: msg }, { status: 409 })
      }
      collabId = (selection as any)?.collab_id
      changed = (selection as any)?.created === true
      // Barter is committed at accept (there's no funding step), so confirm the
      // creator + auto-reject leftovers now — same as the funded path does.
      if (changed && collabId) {
        try { await notifyCollabFunded(admin, collabId) } catch (e) { console.error('[BARTER NOTIFY]', e) }
      }
    } else {
      // Commission is the CREATOR's rate (10% Free / 8% Pro, per computeFee) — not the brand's.
      const creatorPro = await isCreatorProActive(admin, creatorId)
      const { fee, payout } = computeFee(agreedRate, creatorPro)
      const { data: selection, error: collabErr } = await admin.rpc('select_application_atomic', {
        p_application_id: params.id,
        p_agreed_rate: agreedRate,
        p_platform_fee: fee,
        p_creator_payout: payout,
      }).single()
      if (collabErr) {
        console.error('[COLLAB CREATE]', collabErr)
        const msg = await capacityErrorMessage(admin, (application.campaigns as any)?.id, (application.campaigns as any)?.creators_needed, collabErr.message)
        return NextResponse.json({ error: msg }, { status: 409 })
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
      email: false,
    })
    await sendProductEmail({ to: creatorEmail, ...productEmails.applicationRejected({ campaignTitle, applicationId: params.id }) })
  }

  return NextResponse.json({ success: true, status, changed, ...(collabId ? { collab_id: collabId } : {}) })
}

// Creator self-withdraw. Allowed ONLY while the application is still open
// (pending/shortlisted) — never once selected/confirmed or in an active collab.
// 'withdrawn' is terminal and keeps the row, so it can't be used to spam
// re-applications (mirrors how a rejection stays final).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: application } = await supabase.from('applications')
    .select('id, status, creator_profiles(user_id)')
    .eq('id', params.id).single()
  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((application.creator_profiles as any)?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!['pending', 'shortlisted'].includes(application.status)) {
    return NextResponse.json({ error: 'This application can no longer be withdrawn.' }, { status: 409 })
  }

  // Guarded transition: only flip a still-open application (no race with a
  // concurrent brand selection, which would move it to 'selected').
  const admin = createAdminClient()
  const { data: updated, error } = await admin.from('applications')
    .update({ status: 'withdrawn' })
    .eq('id', params.id)
    .in('status', ['pending', 'shortlisted'])
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  if (!updated) return NextResponse.json({ error: 'This application can no longer be withdrawn.' }, { status: 409 })

  return NextResponse.json({ success: true, status: 'withdrawn' })
}
