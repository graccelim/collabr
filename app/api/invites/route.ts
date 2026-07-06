import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'
import { checkRateLimitDurable } from '@/lib/rate-limit'
import { resolvePlan, featureGateResponse, PLAN_COLUMNS } from '@/lib/plans'

const inviteSchema = z.object({
  creator_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  proposed_rate: z.number().int().min(0).max(100_000_000), // cents (0 = pure barter)
  message: z.string().trim().max(1000).optional().or(z.literal('').transform(() => undefined)),
})

// Only brands may invite creators.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (account?.role !== 'brand') {
    return NextResponse.json({ error: 'Only brands can invite creators' }, { status: 403 })
  }

  // Same trust requirements as creating campaigns.
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Verify your email before inviting creators' }, { status: 403 })
  }
  // Admin client: subscription columns are server-only; own row by user_id.
  const { data: brand } = await createAdminClient().from('brand_profiles')
    .select(`id, company_name, onboarding_completed_at, ${PLAN_COLUMNS}`)
    .eq('user_id', user.id).single()
  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
  if (!brand.onboarding_completed_at) {
    return NextResponse.json({ error: 'Complete onboarding before inviting creators' }, { status: 403 })
  }

  // Brand Plus feature (Discovery / direct invites).
  const gate = featureGateResponse(resolvePlan(brand), 'Inviting creators', 'plus')
  if (gate) return gate

  // Anti-spam: 20 invites per hour per brand.
  if (!(await checkRateLimitDurable(`invites:${user.id}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Invite limit reached, try again in an hour' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Campaign must belong to this brand, be active, and pay creators -
  // acceptance creates a paid collab through the existing workflow.
  const { data: campaign } = await admin.from('campaigns')
    .select('id, title, status, comp_type, brand_id')
    .eq('id', parsed.data.campaign_id).eq('brand_id', brand.id).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Only active campaigns can send invites' }, { status: 400 })
  }
  if (!['paid', 'both', 'barter'].includes(campaign.comp_type)) {
    return NextResponse.json({ error: 'This campaign type cannot send invites' }, { status: 400 })
  }
  // Paid/both invites need a positive rate; barter invites may be rate-0.
  if (campaign.comp_type !== 'barter' && parsed.data.proposed_rate <= 0) {
    return NextResponse.json({ error: 'Enter the rate you’re offering for this campaign' }, { status: 400 })
  }

  const { data: creator } = await admin.from('creator_profiles')
    .select('id, user_id').eq('id', parsed.data.creator_id).maybeSingle()
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

  // Already collaborating on this campaign? (Ignore cancelled collabs — an undone
  // selection / expired funding must not permanently block a re-invite. Also use
  // limit(1) so a cancelled+live pair never trips maybeSingle's multi-row error.)
  const { data: existingCollab } = await admin.from('collabs')
    .select('id').eq('campaign_id', campaign.id).eq('creator_id', creator.id)
    .neq('status', 'cancelled').limit(1).maybeSingle()
  if (existingCollab) {
    return NextResponse.json({ error: 'You already have a collab with this creator on this campaign' }, { status: 409 })
  }

  const { data: invite, error } = await admin.from('campaign_invites').insert({
    campaign_id: campaign.id,
    brand_id: brand.id,
    creator_id: creator.id,
    proposed_rate: parsed.data.proposed_rate,
    message: parsed.data.message || null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }).select().single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This creator already has a pending invite for this campaign' }, { status: 409 })
    }
    // 23514 = check-constraint violation. The most likely cause is the legacy
    // proposed_rate > 0 constraint on a barter (rate-0) invite — point the brand
    // at the fix instead of a generic failure.
    if (error.code === '23514' && parsed.data.proposed_rate === 0) {
      return NextResponse.json({
        error: 'Barter invites aren’t enabled on this database yet (migration 032). Apply it, or invite with a cash offer for now.',
      }, { status: 409 })
    }
    console.error('[INVITE CREATE]', error)
    return NextResponse.json({ error: 'Could not send invite. Please try again.' }, { status: 500 })
  }

  if (creator.user_id) {
    await sendNotification({
      userId: creator.user_id,
      type: 'invite_received',
      title: `${brand.company_name || 'A brand'} invited you to "${campaign.title}"`,
      body: 'Review the offer and accept to start the collab.',
      payload: { invite_id: invite.id },
      dedupeKey: `invite:${invite.id}:received`,
      email: false,
    })
    await sendProductEmail({ userId: creator.user_id, ...productEmails.inviteReceived({ brandName: brand.company_name || 'A brand', campaignTitle: campaign.title, inviteId: invite.id, isBarter: parsed.data.proposed_rate <= 0 }) })
  }

  return NextResponse.json(invite, { status: 201 })
}
