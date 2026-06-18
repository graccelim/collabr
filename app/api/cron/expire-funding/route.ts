import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { releaseUnfundedCollab } from '@/lib/collab-funding'

// Funding deadline: a brand has 72h after selecting a creator to fund escrow.
// Past that, the hidden, unfunded collab is cancelled and the applicant returns
// to "pending" — no creator-facing notification (they only ever saw "Applied").
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
    .select('id, application_id, status, payment_status, stripe_payment_intent_id, stripe_transfer_id')
    .eq('status', 'briefed')
    .in('payment_status', ['unfunded', 'authorizing'])
    .lt('created_at', cutoff)

  if (!collabs?.length) return NextResponse.json({ expired: 0 })

  let expired = 0
  for (const c of collabs) {
    try {
      const result = await releaseUnfundedCollab(admin, c)
      if (result.ok) expired++
      else console.error(`[CRON EXPIRE-FUNDING] Skipped collab ${c.id}: ${result.reason}`)
    } catch (e) {
      console.error(`[CRON EXPIRE-FUNDING] Failed for collab ${c.id}:`, e)
    }
  }

  return NextResponse.json({ expired })
}
