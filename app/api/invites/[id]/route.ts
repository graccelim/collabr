import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { notifyCollabFunded } from '@/lib/collab-funding'
import { computeFee } from '@/lib/utils'

// Creator accepts or declines an invite. Acceptance converges into the
// existing collab workflow: ensure an application exists, then create the
// collab through the same atomic selection used by brand-side selection.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let action: string | undefined
  try {
    action = (await req.json())?.action
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'Action must be accept or decline' }, { status: 400 })
  }

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, onboarding_completed_at').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Only creators can respond to invites' }, { status: 403 })

  const admin = createAdminClient()
  const { data: invite } = await admin.from('campaign_invites')
    .select('*, campaigns(id, title, brand_id, status, comp_type, brand_profiles(user_id, plan, company_name))')
    .eq('id', params.id).eq('creator_id', creator.id).maybeSingle()
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.status !== 'pending') {
    return NextResponse.json({ error: `This invite was already ${invite.status}` }, { status: 409 })
  }

  const campaign = invite.campaigns as any
  const brandUserId = campaign?.brand_profiles?.user_id
  const { data: creatorAccount } = await admin.from('users')
    .select('display_name').eq('id', user.id).single()
  const creatorName = creatorAccount?.display_name || 'A creator'

  // ── Decline ────────────────────────────────────────────────────────────────
  if (action === 'decline') {
    const { data: updated } = await admin.from('campaign_invites')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', invite.id).eq('status', 'pending').select('id').maybeSingle()
    if (!updated) return NextResponse.json({ error: 'This invite was already handled' }, { status: 409 })

    if (brandUserId) {
      await sendNotification({
        userId: brandUserId,
        type: 'invite_declined',
        title: `${creatorName} declined your invite`,
        body: campaign?.title ? `Campaign: "${campaign.title}". You can invite other creators.` : undefined,
        payload: { invite_id: invite.id },
        dedupeKey: `invite:${invite.id}:declined`,
      })
    }
    return NextResponse.json({ success: true, status: 'declined' })
  }

  // ── Accept ─────────────────────────────────────────────────────────────────
  // Same trust requirements as applying to campaigns (Phase 5).
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Verify your email before accepting invites' }, { status: 403 })
  }
  if (!creator.onboarding_completed_at) {
    return NextResponse.json({ error: 'Complete onboarding before accepting invites' }, { status: 403 })
  }
  if (!campaign?.id) {
    return NextResponse.json({ error: 'This invite has no campaign attached, ask the brand to re-invite you' }, { status: 409 })
  }
  // The campaign may have changed since the invite was sent - recheck before
  // creating anything. Capacity is enforced atomically by the selection RPC.
  if (campaign.status !== 'active') {
    return NextResponse.json(
      { error: 'This campaign is no longer active, so the invite can\'t be accepted. The brand can re-invite you on a live campaign.' },
      { status: 409 }
    )
  }
  if (!['paid', 'both', 'barter'].includes(campaign.comp_type)) {
    return NextResponse.json(
      { error: 'This campaign can no longer be accepted from an invite.' },
      { status: 409 }
    )
  }
  // A rate-0 invite on a barter/both campaign is a true barter deal.
  const isBarterDeal = (!invite.proposed_rate || invite.proposed_rate <= 0)
    && ['barter', 'both'].includes(campaign.comp_type)

  // Ensure an application exists with the invited rate, then reuse the
  // existing atomic selection to create the collab.
  let applicationId: string
  const { data: existingApp } = await admin.from('applications')
    .select('id, status, proposed_rate')
    .eq('campaign_id', campaign.id).eq('creator_id', creator.id).maybeSingle()

  if (existingApp) {
    if (existingApp.status === 'selected') {
      // Collab already exists through the normal path - just close the invite.
      const { data: collab } = await admin.from('collabs')
        .select('id').eq('application_id', existingApp.id).maybeSingle()
      await admin.from('campaign_invites')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', invite.id).eq('status', 'pending')
      return NextResponse.json({ success: true, status: 'accepted', collab_id: collab?.id })
    }
    applicationId = existingApp.id
    if (existingApp.proposed_rate !== invite.proposed_rate) {
      await admin.from('applications')
        .update({ proposed_rate: invite.proposed_rate }).eq('id', existingApp.id)
    }
  } else {
    const { data: newApp, error: appErr } = await admin.from('applications').insert({
      campaign_id: campaign.id,
      creator_id: creator.id,
      pitch: `Accepted a direct invite from ${campaign.brand_profiles?.company_name || 'the brand'}.`,
      proposed_rate: invite.proposed_rate,
    }).select('id').single()
    if (appErr || !newApp) {
      console.error('[INVITE ACCEPT] application insert failed:', appErr)
      return NextResponse.json({ error: 'Could not accept the invite. Please try again.' }, { status: 500 })
    }
    applicationId = newApp.id
  }

  let collabId: string | undefined
  if (isBarterDeal) {
    // True barter: no cash, no escrow — same atomic path as brand-side barter.
    const { data: selection, error: barterErr } = await admin.rpc('select_barter_collab', {
      p_application_id: applicationId,
    }).single()
    if (barterErr) {
      console.error('[INVITE ACCEPT BARTER]', barterErr)
      const friendly = barterErr.message.includes('capacity')
        ? 'This campaign has already filled all its creator slots.'
        : 'Could not accept the invite. Please try again or contact support.'
      return NextResponse.json({ error: friendly }, { status: 409 })
    }
    collabId = (selection as any)?.collab_id
  } else {
    const plan: 'free' | 'pro' = campaign.brand_profiles?.plan || 'free'
    const { fee, payout } = computeFee(invite.proposed_rate, plan)
    const { data: selection, error: collabErr } = await admin.rpc('select_application_atomic', {
      p_application_id: applicationId,
      p_agreed_rate: invite.proposed_rate,
      p_platform_fee: fee,
      p_creator_payout: payout,
    }).single()
    if (collabErr) {
      console.error('[INVITE ACCEPT]', collabErr)
      const friendly = collabErr.message.includes('capacity')
        ? 'This campaign has already filled all its creator slots.'
        : 'Could not accept the invite. Please try again or contact support.'
      return NextResponse.json({ error: friendly }, { status: 409 })
    }
    collabId = (selection as any)?.collab_id
  }

  const { data: updatedInvite } = await admin.from('campaign_invites')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', invite.id).eq('status', 'pending').select('id').maybeSingle()
  if (!updatedInvite) {
    // Collab exists either way; report success but flag the race.
    console.warn('[INVITE ACCEPT] invite already transitioned:', invite.id)
  }

  // Barter is committed at acceptance (no funding step): confirm the creator +
  // free leftover applicants now, exactly like the brand-side barter path.
  if (isBarterDeal && collabId) {
    try { await notifyCollabFunded(admin, collabId) } catch (e) { console.error('[INVITE BARTER NOTIFY]', e) }
  }

  if (brandUserId) {
    await sendNotification({
      userId: brandUserId,
      type: 'invite_accepted',
      title: `${creatorName} accepted your invite 🎉`,
      body: isBarterDeal
        ? 'Your barter collab is confirmed — the creator can start now.'
        : 'The collab has been created, fund escrow to get work started.',
      payload: { invite_id: invite.id, collab_id: collabId },
      dedupeKey: `invite:${invite.id}:accepted`,
    })
    if (collabId) await sendProductEmail({ userId: brandUserId, ...productEmails.inviteAccepted({ creatorName, collabId, inviteId: invite.id }) })
  }

  return NextResponse.json({ success: true, status: 'accepted', collab_id: collabId })
}
