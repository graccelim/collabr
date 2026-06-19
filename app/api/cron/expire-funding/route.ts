import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { releaseUnfundedCollab } from '@/lib/collab-funding'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

// Funding deadline: a brand has 72h after selecting a creator to fund escrow.
// Past that, the hidden, unfunded collab is cancelled and the applicant returns
// to "pending" — no creator-facing notification (they only ever saw "Applied"),
// but the BRAND is told their selection expired.
// Idempotent: only briefed/unfunded collabs older than 72h are touched, and the
// release writes are CAS-guarded, so a re-run (or overlap) is a no-op.
const FUNDING_DEADLINE_HOURS = 72

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - FUNDING_DEADLINE_HOURS * 60 * 60 * 1000).toISOString()
  const admin = createAdminClient()
  const { data: collabs } = await admin.from('collabs')
    .select('id, application_id, campaign_id, status, payment_status, stripe_payment_intent_id, stripe_transfer_id, brand_profiles(user_id, users(email)), creator_profiles(users(display_name)), campaigns(title)')
    .eq('status', 'briefed')
    .in('payment_status', ['unfunded', 'authorizing'])
    .lt('created_at', cutoff)

  if (!collabs?.length) return NextResponse.json({ expired: 0 })

  let expired = 0
  for (const c of collabs) {
    try {
      const result = await releaseUnfundedCollab(admin, c)
      if (!result.ok) { console.error(`[CRON EXPIRE-FUNDING] Skipped collab ${c.id}: ${result.reason}`); continue }
      expired++

      // Tell the brand their selection expired (the creator was never notified).
      const brandUserId = (c.brand_profiles as any)?.user_id
      const brandEmail = (c.brand_profiles as any)?.users?.email
      const creatorName = (c.creator_profiles as any)?.users?.display_name || 'the creator'
      const campaignTitle = (c.campaigns as any)?.title || 'your campaign'
      const campaignId = c.campaign_id as string
      if (brandUserId) {
        await sendNotification({
          userId: brandUserId, type: 'selection_expired',
          title: 'Your selection expired',
          body: `You selected ${creatorName} for "${campaignTitle}", but payment wasn't secured within 72 hours. They've been returned to the applicant pool.`,
          payload: { campaign_id: campaignId, href: `/campaigns/${campaignId}` },
          dedupeKey: `collab:${c.id}:selection-expired`,
        })
        if (brandEmail) {
          await sendProductEmail({ to: brandEmail, ...productEmails.selectionExpired({ creatorName, campaignTitle, campaignId, collabId: c.id }) })
        }
      }
    } catch (e) {
      console.error(`[CRON EXPIRE-FUNDING] Failed for collab ${c.id}:`, e)
    }
  }

  return NextResponse.json({ expired })
}
