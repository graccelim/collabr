import type { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails, sendOpsAdminEmail } from '@/lib/email'

type Admin = ReturnType<typeof createAdminClient>

export interface CreateInviteInput {
  campaignId: string
  brandId: string
  brandName: string
  creatorId: string
  proposedRate: number
  message?: string | null
}

export type CreateInviteResult =
  | { ok: true; invite: { id: string } }
  | { ok: false; status: number; error: string }

type CampaignCheck =
  | { ok: true; campaign: { id: string; title: string; status: string; comp_type: string; brand_id: string } }
  | { ok: false; status: number; error: string }

/**
 * Campaign-side validity shared by a direct invite and a pending collab
 * request - active, invite-capable comp type, a real rate unless barter. Both
 * "create the real thing now" and "queue it until the creator can see it"
 * must reject a closed/invalid campaign identically.
 */
async function checkCampaignForInvite(admin: Admin, campaignId: string, brandId: string, proposedRate: number): Promise<CampaignCheck> {
  const { data: campaign } = await admin.from('campaigns')
    .select('id, title, status, comp_type, brand_id')
    .eq('id', campaignId).eq('brand_id', brandId).maybeSingle()
  if (!campaign) return { ok: false, status: 404, error: 'Campaign not found' }
  if (campaign.status !== 'active') {
    return { ok: false, status: 400, error: 'Only active campaigns can send invites' }
  }
  if (!['paid', 'both', 'barter'].includes(campaign.comp_type)) {
    return { ok: false, status: 400, error: 'This campaign type cannot send invites' }
  }
  if (campaign.comp_type !== 'barter' && proposedRate <= 0) {
    return { ok: false, status: 400, error: 'Enter the rate you’re offering for this campaign' }
  }
  return { ok: true, campaign }
}

/**
 * Core invite-creation logic - campaign validity, comp-type/rate rules,
 * duplicate-collab guard, insert, notify. Shared by POST /api/invites (a
 * logged-in brand inviting a claimed creator directly) and the claim-flow
 * completion route (materializing a "Request Collaboration" ask the moment an
 * unclaimed creator claims their profile) so both paths enforce identically -
 * a campaign that closed while you were still DMing the creator must reject
 * the invite the same way it would if the brand tried again from the UI.
 */
export async function createInvite(admin: Admin, input: CreateInviteInput): Promise<CreateInviteResult> {
  const check = await checkCampaignForInvite(admin, input.campaignId, input.brandId, input.proposedRate)
  if (!check.ok) return check
  const { campaign } = check

  const { data: existingCollab } = await admin.from('collabs')
    .select('id').eq('campaign_id', campaign.id).eq('creator_id', input.creatorId)
    .neq('status', 'cancelled').limit(1).maybeSingle()
  if (existingCollab) {
    return { ok: false, status: 409, error: 'You already have a collab with this creator on this campaign' }
  }

  const { data: invite, error } = await admin.from('campaign_invites').insert({
    campaign_id: campaign.id,
    brand_id: input.brandId,
    creator_id: input.creatorId,
    proposed_rate: input.proposedRate,
    message: input.message || null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }).select().single()

  if (error) {
    if (error.code === '23505') {
      return { ok: false, status: 409, error: 'This creator already has a pending invite for this campaign' }
    }
    if (error.code === '23514' && input.proposedRate === 0) {
      return {
        ok: false, status: 409,
        error: 'Barter invites aren’t enabled on this database yet (migration 032). Apply it, or invite with a cash offer for now.',
      }
    }
    console.error('[INVITE CREATE]', error)
    return { ok: false, status: 500, error: 'Could not send invite. Please try again.' }
  }

  const { data: creator } = await admin.from('creator_profiles').select('user_id').eq('id', input.creatorId).maybeSingle()
  if (creator?.user_id) {
    await sendNotification({
      userId: creator.user_id,
      type: 'invite_received',
      title: `${input.brandName || 'A brand'} invited you to "${campaign.title}"`,
      body: 'Review the offer and accept to start the collab.',
      payload: { invite_id: invite.id },
      dedupeKey: `invite:${invite.id}:received`,
      email: false,
    })
    await sendProductEmail({
      userId: creator.user_id,
      ...productEmails.inviteReceived({
        brandName: input.brandName || 'A brand', campaignTitle: campaign.title,
        inviteId: invite.id, isBarter: input.proposedRate <= 0,
      }),
    })
  }

  return { ok: true, invite }
}

export interface CreatePendingRequestInput {
  campaignId: string
  brandId: string
  brandName: string
  creatorId: string
  proposedRate: number
  message?: string | null
}

export type CreatePendingRequestResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Queues a "Request Collaboration" ask on a creator who hasn't claimed their
 * profile yet - no campaign_invites row (nothing exists for them to see or
 * accept), just a record that materializes into a real invite via
 * createInvite() the moment they claim (see app/api/claim/[token]/route.ts).
 * Notifies the admin inbox since there's no in-app notification target.
 */
export async function createPendingCollabRequest(admin: Admin, input: CreatePendingRequestInput): Promise<CreatePendingRequestResult> {
  const check = await checkCampaignForInvite(admin, input.campaignId, input.brandId, input.proposedRate)
  if (!check.ok) return check
  const { campaign } = check

  const { data: creator } = await admin.from('creator_profiles')
    .select('display_name').eq('id', input.creatorId).maybeSingle()

  const { error } = await admin.from('pending_collab_requests').insert({
    campaign_id: campaign.id,
    brand_id: input.brandId,
    creator_id: input.creatorId,
    proposed_rate: input.proposedRate,
    message: input.message || null,
  })
  if (error) {
    if (error.code === '23505') {
      return { ok: false, status: 409, error: 'You already requested this creator for this campaign' }
    }
    console.error('[PENDING COLLAB REQUEST]', error)
    return { ok: false, status: 500, error: 'Could not send request. Please try again.' }
  }

  await sendOpsAdminEmail(
    `Collab request for ${creator?.display_name || 'an unclaimed creator'}`,
    {
      Creator: creator?.display_name || input.creatorId,
      Brand: input.brandName || 'A brand',
      Campaign: campaign.title,
      'Proposed rate': `$${(input.proposedRate / 100).toFixed(2)}`,
      Message: input.message || '(none)',
    },
    `pending-collab:${input.creatorId}`
  ).catch(e => console.error('[PENDING COLLAB REQUEST] ops email failed:', e))

  return { ok: true }
}
