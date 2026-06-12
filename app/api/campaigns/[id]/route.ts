import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolvePlan, proGateResponse, PLAN_COLUMNS } from '@/lib/plans'

async function getAuthedBrand(supabase: ReturnType<typeof createClient>, userId: string, campaignId: string) {
  const { data: campaign } = await supabase.from('campaigns')
    .select('*, brand_profiles(user_id)').eq('id', campaignId).single()
  if (!campaign) return { error: 'Not found', status: 404 as const, campaign: null }
  if ((campaign.brand_profiles as any)?.user_id !== userId) return { error: 'Forbidden', status: 403 as const, campaign: null }
  return { error: null, status: 200 as const, campaign }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase.from('campaigns')
    .select('*, brand_profiles(company_name, logo_url, industry, website)')
    .eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, status, campaign } = await getAuthedBrand(supabase, user.id, params.id)
  if (error) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const allowed = ['title', 'brief', 'deliverable_types', 'comp_type', 'budget_min', 'budget_max',
    'barter_detail', 'niche_tags', 'min_followers', 'creators_needed', 'deadline', 'status']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  // Switching a campaign to barter is Pro (complimentary while in beta).
  if (['barter', 'both'].includes(updates.comp_type as string)) {
    const { data: brandPlan } = await createAdminClient().from('brand_profiles')
      .select(PLAN_COLUMNS).eq('user_id', user.id).single()
    const gate = proGateResponse(resolvePlan(brandPlan), 'Barter campaigns')
    if (gate) return gate
  }

  const admin = createAdminClient()
  const { data, error: updateErr } = await admin.from('campaigns')
    .update(updates).eq('id', params.id).select().single()
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, status } = await getAuthedBrand(supabase, user.id, params.id)
  if (error) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()
  await admin.from('campaigns').update({ status: 'closed' }).eq('id', params.id)
  return NextResponse.json({ success: true })
}
