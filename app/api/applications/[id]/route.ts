import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { computeFee } from '@/lib/utils'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await req.json()
  if (!['shortlisted', 'selected', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Load application with campaign and brand ownership check
  const { data: application } = await supabase.from('applications')
    .select('*, campaigns(id, brand_id, title, creators_needed, brand_profiles(user_id, plan)), creator_profiles(id, user_id, users(display_name, email))')
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
    const agreedRate = application.proposed_rate
    if (!agreedRate || agreedRate <= 0) {
      return NextResponse.json({ error: 'A positive agreed rate is required before selecting a creator.' }, { status: 400 })
    }
    const { fee, payout } = computeFee(agreedRate, plan)

    const campaignId = (application.campaigns as any)?.id

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

    if (changed) {
      await sendNotification({
        userId: creatorUserId,
        type: 'application_selected',
        title: `You've been selected for "${campaignTitle}"`,
        body: 'Your collab has been created, escrow funding is the next step.',
        payload: { application_id: params.id, campaign_id: campaignId, collab_id: collabId },
        dedupeKey: `application:${params.id}:selected`,
      })
      await sendProductEmail({ to: creatorEmail, ...productEmails.applicationSelected({ campaignTitle, applicationId: params.id, collabId }) })

      // Instant decline on fill: if this selection used the last slot, give every
      // remaining applicant a definite answer now (don't make them wait for the cron).
      const needed = (application.campaigns as any)?.creators_needed || 1
      const { count: filledCount } = await admin.from('collabs')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId).neq('status', 'cancelled')
      if ((filledCount || 0) >= needed) {
        const { data: leftover } = await admin.from('applications')
          .select('id, creator_profiles(user_id, users(email))')
          .eq('campaign_id', campaignId)
          .in('status', ['pending', 'shortlisted'])
        if (leftover && leftover.length > 0) {
          await admin.from('applications').update({ status: 'rejected' })
            .in('id', leftover.map(l => l.id)).in('status', ['pending', 'shortlisted'])
          for (const l of leftover) {
            const uid = (l.creator_profiles as any)?.user_id
            const email = (l.creator_profiles as any)?.users?.email
            if (uid) await sendNotification({
              userId: uid, type: 'application_rejected',
              title: `Application closed for "${campaignTitle}"`,
              body: 'This campaign has been filled. Thanks for applying, new campaigns are posted regularly.',
              payload: { application_id: l.id },
              dedupeKey: `application:${l.id}:rejected`,
            })
            if (email) await sendProductEmail({ to: email, ...productEmails.applicationRejected({ campaignTitle, applicationId: l.id }) })
          }
        }
      }
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
