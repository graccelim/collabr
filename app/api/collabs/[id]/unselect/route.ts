import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
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

  // Ownership + money guard + cancellation all happen atomically under a row
  // lock inside the RPC (race-safe vs the Stripe funding webhook). We pass the
  // brand user id so the RPC enforces ownership.
  const result = await releaseUnfundedCollab(createAdminClient(), { id: params.id, application_id: null, status: '', payment_status: '' }, user.id)
  if (!result.ok) {
    if (result.reason === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (result.reason === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (result.reason === 'not_unfunded') {
      return NextResponse.json(
        { error: 'This collab is already funded and can no longer be undone. Contact support.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Could not undo the selection. Please try again or contact support.' },
      { status: 502 }
    )
  }
  return NextResponse.json({ success: true })
}
