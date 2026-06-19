import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Nightly full recompute of creator_scores (powers ranking; never displayed).
// Idempotent - recomputes from source tables, so a missed run self-heals.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  // Expire invites first so response inputs are current before scoring.
  await admin.rpc('expire_overdue_invites')
  const { data, error } = await admin.rpc('recompute_creator_scores', { p_creator_id: null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recomputed: data ?? 0 })
}
