import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const niche = searchParams.get('niche')
  const type = searchParams.get('type')
  const minFollowers = searchParams.get('minFollowers')

  let query = supabase.from('campaigns')
    .select('*, brand_profiles(company_name, logo_url)')
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (niche) query = query.contains('niche_tags', [niche])
  if (type) query = query.eq('comp_type', type)
  if (minFollowers) query = query.gte('min_followers', parseInt(minFollowers))

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Email must be verified before creating campaigns.
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: 'Verify your email before creating campaigns' },
      { status: 403 }
    )
  }

  const { data: brand } = await supabase.from('brand_profiles')
    .select('id, plan, onboarding_completed_at').eq('user_id', user.id).single()
  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })

  // Onboarding (company name, industry, website or social) must be complete.
  if (!brand.onboarding_completed_at) {
    return NextResponse.json(
      { error: 'Complete onboarding before creating campaigns' },
      { status: 403 }
    )
  }

  // Free plan: max 2 active campaigns
  if (brand.plan === 'free') {
    const { count } = await supabase.from('campaigns')
      .select('*', { count: 'exact', head: true }).eq('brand_id', brand.id).eq('status', 'active')
    if ((count || 0) >= 2) return NextResponse.json(
      { error: 'Free plan allows max 2 active campaigns. Upgrade to Pro for unlimited.' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('campaigns').insert({
    brand_id: brand.id,
    title: body.title,
    brief: body.brief,
    deliverable_types: body.deliverable_types || [],
    comp_type: body.comp_type,
    budget_min: body.budget_min || null,
    budget_max: body.budget_max || null,
    barter_detail: body.barter_detail || null,
    niche_tags: body.niche_tags || [],
    min_followers: body.min_followers || 0,
    creators_needed: body.creators_needed || 1,
    deadline: body.deadline || null,
    status: 'active',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
