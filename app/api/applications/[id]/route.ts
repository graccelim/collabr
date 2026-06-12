import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
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
    .select('*, campaigns(id, brand_id, title, brand_profiles(user_id, plan)), creator_profiles(id, user_id, users(display_name, email))')
    .eq('id', params.id).single()
  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (application.campaigns as any)?.brand_profiles?.user_id
  if (brandUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  await admin.from('applications').update({ status }).eq('id', params.id)

  const creatorUserId = (application.creator_profiles as any)?.user_id
  const creatorId = (application.creator_profiles as any)?.id
  const campaignTitle = (application.campaigns as any)?.title

  let collabId: string | undefined

  if (status === 'selected' && creatorUserId && creatorId) {
    const plan: 'free' | 'pro' = (application.campaigns as any)?.brand_profiles?.plan || 'free'
    const agreedRate = application.proposed_rate || 0
    const { fee, payout } = computeFee(agreedRate, plan)

    const brandId = (application.campaigns as any)?.brand_id
    const campaignId = (application.campaigns as any)?.id

    const { data: newCollab, error: collabErr } = await admin.from('collabs').insert({
      application_id: params.id,
      campaign_id: campaignId,
      creator_id: creatorId,
      brand_id: brandId,
      agreed_rate: agreedRate,
      platform_fee: fee,
      creator_payout: payout,
      status: 'briefed',
    }).select('id').single()
    if (collabErr) {
      console.error('[COLLAB CREATE]', collabErr)
      return NextResponse.json({ error: 'Could not create collab' }, { status: 500 })
    }

    collabId = newCollab?.id

    await sendNotification({
      userId: creatorUserId,
      type: 'application_selected',
      title: `You've been selected for "${campaignTitle}"`,
      body: 'Check your collabs to get started.',
      payload: { application_id: params.id, campaign_id: campaignId },
    })
  } else if (status === 'shortlisted' && creatorUserId) {
    await sendNotification({
      userId: creatorUserId,
      type: 'application_shortlisted',
      title: `Shortlisted for "${campaignTitle}"`,
      body: 'The brand has shortlisted your application.',
      payload: { application_id: params.id },
    })
  } else if (status === 'rejected' && creatorUserId) {
    await sendNotification({
      userId: creatorUserId,
      type: 'application_rejected',
      title: `Application not selected for "${campaignTitle}"`,
      payload: { application_id: params.id },
    })
  }

  return NextResponse.json({ success: true, status, ...(collabId ? { collab_id: collabId } : {}) })
}
