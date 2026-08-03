import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimitDurable } from '@/lib/rate-limit'
import { resolvePlan, featureGateResponse, PLAN_COLUMNS } from '@/lib/plans'
import { createInvite, createPendingCollabRequest } from '@/lib/invites'

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

  const { data: creator } = await admin.from('creator_profiles')
    .select('id, user_id').eq('id', parsed.data.creator_id).maybeSingle()
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

  // Claimed: send a real invite now, exactly like today. Not yet claimed:
  // queue the ask - there's no account to notify or invite yet - and it
  // materializes into a real invite automatically the moment they claim.
  if (!creator.user_id) {
    const pending = await createPendingCollabRequest(admin, {
      campaignId: parsed.data.campaign_id,
      brandId: brand.id,
      brandName: brand.company_name || 'A brand',
      creatorId: creator.id,
      proposedRate: parsed.data.proposed_rate,
      message: parsed.data.message,
    })
    if (!pending.ok) return NextResponse.json({ error: pending.error }, { status: pending.status })
    return NextResponse.json({ pending: true }, { status: 201 })
  }

  const result = await createInvite(admin, {
    campaignId: parsed.data.campaign_id,
    brandId: brand.id,
    brandName: brand.company_name || 'A brand',
    creatorId: creator.id,
    proposedRate: parsed.data.proposed_rate,
    message: parsed.data.message,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result.invite, { status: 201 })
}
