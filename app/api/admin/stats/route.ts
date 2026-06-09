import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createAdminClient()

  const [
    { count: creators },
    { count: brands },
    { count: activeCampaigns },
    { count: totalCollabs },
    { count: pendingDisputes },
    { data: gmbData },
  ] = await Promise.all([
    admin.from('creator_profiles').select('*', { count: 'exact', head: true }),
    admin.from('brand_profiles').select('*', { count: 'exact', head: true }),
    admin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('collabs').select('*', { count: 'exact', head: true }),
    admin.from('disputes').select('*', { count: 'exact', head: true }).eq('outcome', 'pending'),
    admin.from('collabs').select('agreed_rate').eq('status', 'completed'),
  ])

  const totalGMV = (gmbData || []).reduce((sum: number, c: any) => sum + (c.agreed_rate || 0), 0)

  return NextResponse.json({
    creators: creators || 0,
    brands: brands || 0,
    active_campaigns: activeCampaigns || 0,
    total_collabs: totalCollabs || 0,
    pending_disputes: pendingDisputes || 0,
    total_gmv_sgd_cents: totalGMV,
  })
}
