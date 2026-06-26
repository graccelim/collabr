import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { mockAnalyticsEnabled } from '@/lib/dev/mock'
import { seedCreatorAnalytics, resetCreatorAnalytics, seedBrandCampaigns } from '@/lib/dev/mockAnalytics'

// DEVELOPER-ONLY. Seeds realistic mock analytics for the logged-in user's profiles,
// run through the real deterministic engine. Hard-gated by mockAnalyticsEnabled()
// (off in production unless ALLOW_MOCK_IN_PROD=true). No platform API calls.
//   POST   ?density=rich|thin&pro=active|expired   → seed
//   DELETE                                          → reset (delete mock data)
async function profiles(req: NextRequest) {
  if (!mockAnalyticsEnabled()) return { gate: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { gate: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const admin = createAdminClient()
  const [{ data: creator }, { data: brand }] = await Promise.all([
    admin.from('creator_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    admin.from('brand_profiles').select('id').eq('user_id', user.id).maybeSingle(),
  ])
  return { admin, creator, brand }
}

export async function POST(req: NextRequest) {
  const ctx = await profiles(req)
  if (ctx.gate) return ctx.gate
  const { admin, creator, brand } = ctx
  const density = req.nextUrl.searchParams.get('density') === 'thin' ? 'thin' : 'rich'
  const pro = req.nextUrl.searchParams.get('pro') === 'expired' ? 'expired' : 'active'

  const result: Record<string, unknown> = { density, pro }
  if (creator) result.creator = await seedCreatorAnalytics(admin!, creator.id, { density, pro })
  if (brand) result.brand = await seedBrandCampaigns(admin!, brand.id)
  if (!creator && !brand) return NextResponse.json({ error: 'No creator or brand profile for this user.' }, { status: 400 })
  return NextResponse.json({ ok: true, ...result })
}

export async function DELETE(req: NextRequest) {
  const ctx = await profiles(req)
  if (ctx.gate) return ctx.gate
  const { admin, creator, brand } = ctx
  if (creator) await resetCreatorAnalytics(admin!, creator.id)
  if (brand) {
    const { data: campaigns } = await admin!.from('campaigns').select('id').eq('brand_id', brand.id)
    const ids = (campaigns ?? []).map((c) => c.id)
    if (ids.length) await admin!.from('campaign_rollups').delete().in('campaign_id', ids)
  }
  return NextResponse.json({ ok: true, reset: true })
}
