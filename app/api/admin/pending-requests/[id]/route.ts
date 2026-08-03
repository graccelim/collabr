import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'

// Admin-only outreach workflow on a pending_collab_requests row - "did I
// already DM this brand back?" Never creator/brand-visible. 'claimed' and
// 'expired' are deliberately not valid values here: they're system facts
// (materialized_at, claim expiry) shown in the UI, not something to store.
const STATUSES = ['pending', 'contacted', 'interested', 'declined'] as const
const patchSchema = z.object({ status: z.enum(STATUSES) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdminApi()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const admin = createAdminClient()
  const { error: updateErr } = await admin.from('pending_collab_requests')
    .update({ status: parsed.data.status })
    .eq('id', params.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
