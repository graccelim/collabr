import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { capacityBreakdown, requiresExpectedRate } from '@/lib/collab-status'

const applicationSchema = z.object({
  campaign_id: z.string().uuid('Invalid campaign'),
  pitch: z.string().trim()
    .min(30, 'Your pitch must be at least 30 characters')
    .max(2000, 'Your pitch must be 2000 characters or less'),
  proposed_rate: z.number().int().positive().max(100_000_000).nullish(), // cents
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Email must be verified before applying to campaigns.
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: 'Verify your email before applying to campaigns' },
      { status: 403 }
    )
  }

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, boost_active_until, onboarding_completed_at').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  // Onboarding (niche + at least one social account) must be complete.
  if (!creator.onboarding_completed_at) {
    return NextResponse.json(
      { error: 'Complete onboarding before applying to campaigns' },
      { status: 403 }
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = applicationSchema.safeParse(rawBody)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue?.message || 'Invalid input' }, { status: 400 })
  }
  const body = parsed.data
  const isBoosted = creator.boost_active_until && new Date(creator.boost_active_until) > new Date()
  const admin = createAdminClient()

  // The campaign must exist and still be accepting applications.
  const { data: campaign } = await admin.from('campaigns')
    .select('id, title, status, comp_type, creators_needed, brand_profiles(user_id)')
    .eq('id', body.campaign_id).maybeSingle()
  if (!campaign) {
    return NextResponse.json({ error: 'This campaign no longer exists' }, { status: 404 })
  }
  if (campaign.status !== 'active') {
    return NextResponse.json(
      { error: 'This campaign is no longer accepting applications' },
      { status: 409 }
    )
  }
  // Capacity: a slot is taken by a confirmed (funded) collab OR a reserved
  // (selected-but-unfunded) one. Once there's no AVAILABLE slot, stop new
  // applications — so creators don't apply to campaigns they can't be picked for
  // (the selection RPC counts reserved slots too, so this keeps them in sync).
  const { data: campaignCollabs } = await admin.from('collabs')
    .select('status, payment_status').eq('campaign_id', body.campaign_id)
  if (capacityBreakdown(campaign.creators_needed, campaignCollabs || []).available <= 0) {
    return NextResponse.json(
      { error: 'This campaign is already filled' },
      { status: 409 }
    )
  }

  // Compensation requirements: a PAID campaign needs an expected rate; a BARTER
  // campaign carries no required cash rate but may include an optional one.
  if (requiresExpectedRate(campaign.comp_type) && (!body.proposed_rate || body.proposed_rate <= 0)) {
    return NextResponse.json(
      { error: 'Add your expected rate to apply to this paid campaign' },
      { status: 400 }
    )
  }

  // Anti-spam: max 10 applications per creator per hour, counted durably.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await admin.from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', creator.id)
    .gte('created_at', oneHourAgo)
  if ((recentCount || 0) >= 10) {
    return NextResponse.json(
      { error: 'Application limit reached, try again in an hour' },
      { status: 429 }
    )
  }

  // A previously-withdrawn application is revived (the creator chose to leave,
  // so re-applying is allowed). A 'rejected' one stays final; an open one is a
  // duplicate. The (campaign, creator) unique index means at most one row.
  const { data: existing } = await admin.from('applications')
    .select('id, status').eq('campaign_id', body.campaign_id).eq('creator_id', creator.id).maybeSingle()
  if (existing && existing.status !== 'withdrawn') {
    return NextResponse.json(
      { error: existing.status === 'rejected' ? 'You can’t reapply, this application was already decided.' : 'You have already applied to this campaign' },
      { status: 409 }
    )
  }

  let data: any
  if (existing) {
    const { data: revived, error } = await admin.from('applications')
      .update({ status: 'pending', pitch: body.pitch, proposed_rate: body.proposed_rate || null, is_boosted: !!isBoosted, created_at: new Date().toISOString() })
      .eq('id', existing.id).eq('status', 'withdrawn').select().single()
    if (error || !revived) {
      console.error('[APPLICATION REVIVE]', error)
      return NextResponse.json({ error: 'Your application could not be submitted. Please try again.' }, { status: 500 })
    }
    data = revived
  } else {
    const { data: inserted, error } = await admin.from('applications').insert({
      campaign_id: body.campaign_id,
      creator_id: creator.id,
      pitch: body.pitch,
      proposed_rate: body.proposed_rate || null,
      is_boosted: !!isBoosted,
    }).select().single()
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already applied to this campaign' }, { status: 409 })
      }
      console.error('[APPLICATION CREATE]', error)
      return NextResponse.json({ error: 'Your application could not be submitted. Please try again.' }, { status: 500 })
    }
    data = inserted
  }

  // Notify brand (campaign was fetched and validated above)
  const brandUserId = (campaign.brand_profiles as any)?.user_id
  const campaignTitle = campaign.title || 'your campaign'
  if (brandUserId) {
    await sendNotification({
      userId: brandUserId,
      type: 'new_application',
      title: `New application for "${campaignTitle}"`,
      body: 'Review the pitch and shortlist or select the creator.',
      payload: { application_id: data.id, campaign_id: body.campaign_id },
      email: false,
    })
    // Email the brand (deduped) + send the creator a confirmation.
    await sendProductEmail({ userId: brandUserId, ...productEmails.newApplication({ campaignTitle, applicationId: data.id, campaignId: body.campaign_id }) })
  }
  await sendProductEmail({ to: user.email, ...productEmails.applicationSubmitted({ campaignTitle, applicationId: data.id }) })

  return NextResponse.json(data, { status: 201 })
}
