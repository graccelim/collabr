import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Expire pending invites past their window so they count as non-responses in
// the creator response metric. Idempotent.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('expire_overdue_invites')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expired: data ?? 0 })
}
