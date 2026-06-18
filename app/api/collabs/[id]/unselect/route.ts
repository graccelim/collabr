import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { canReleaseUnfunded } from '@/lib/collab-status'
import { releaseUnfundedCollab } from '@/lib/collab-funding'

/**
 * Brand "Undo selection" — only before escrow is funded. Cancels the hidden
 * collab, releases any authorization hold, and returns the applicant to
 * "pending" (the creator was never notified and keeps seeing "Applied").
 * After funding this 404s/409s — the brand must use Contact Support instead.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('id, application_id, status, payment_status, stripe_payment_intent_id, stripe_transfer_id, brand_profiles(user_id)')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Brand-only: undo is the brand's action.
  if ((collab.brand_profiles as { user_id?: string } | null)?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!canReleaseUnfunded(collab)) {
    return NextResponse.json(
      { error: 'This collab is already funded and can no longer be undone. Contact support.' },
      { status: 409 }
    )
  }

  const result = await releaseUnfundedCollab(createAdminClient(), collab)
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Could not undo the selection. Please try again or contact support.' },
      { status: 502 }
    )
  }
  return NextResponse.json({ success: true })
}
