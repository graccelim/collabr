import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('creator_profiles')
    .update({ boost_active_until: null })
    .lt('boost_active_until', new Date().toISOString())
    .not('boost_active_until', 'is', null)
    .select('id')
  return NextResponse.json({ expired: data?.length || 0 })
}
