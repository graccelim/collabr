import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ensureCampaignSlug } from '@/lib/slug-server'
import { NextRequest, NextResponse } from 'next/server'
import { resolvePlan, proGateResponse, PLAN_COLUMNS } from '@/lib/plans'
import { normalizeNiche, normalizeNicheTags } from '@/lib/niches'

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

  const nicheSlug = niche ? normalizeNiche(niche) : null
  if (nicheSlug) query = query.contains('niche_tags', [nicheSlug])
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

  // Admin client: subscription columns are server-only; own row by user_id.
  const { data: brand } = await createAdminClient().from('brand_profiles')
    .select(`id, company_name, onboarding_completed_at, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })

  // Onboarding (company name, industry, website or social) must be complete.
  if (!brand.onboarding_completed_at) {
    return NextResponse.json(
      { error: 'Complete onboarding before creating campaigns' },
      { status: 403 }
    )
  }

  // Brand Free includes UNLIMITED paid campaigns (Collabr earns commission from
  // the creator's payout, not the brand). Only barter is tier-gated (below).
  const plan = resolvePlan(brand)

  const body = await req.json()

  // Title: required, trimmed, capped at 70 chars (matches the form) so it stays
  // legible everywhere it's shown (cards, notifications, emails).
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'Campaign title is required.' }, { status: 400 })
  if (title.length > 70) return NextResponse.json({ error: 'Campaign title must be 70 characters or fewer.' }, { status: 400 })

  // Barter campaigns are a Pro feature (complimentary while in beta).
  if (['barter', 'both'].includes(body.comp_type)) {
    const gate = proGateResponse(plan, 'Barter campaigns')
    if (gate) return gate
  }
  const admin = createAdminClient()
  const { data, error } = await admin.from('campaigns').insert({
    brand_id: brand.id,
    title,
    brief: body.brief,
    deliverable_types: body.deliverable_types || [],
    comp_type: body.comp_type,
    budget_min: body.budget_min || null,
    budget_max: body.budget_max || null,
    barter_detail: body.barter_detail || null,
    // Normalize to canonical slugs so matching is reliable + the DB trigger accepts them.
    niche_tags: normalizeNicheTags(Array.isArray(body.niche_tags) ? body.niche_tags : []),
    min_followers: body.min_followers || 0,
    creators_needed: body.creators_needed || 1,
    deadline: body.deadline || null,
    status: 'active',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Public, shareable slug from title + brand name (best-effort).
  if (data?.id) {
    const slug = await ensureCampaignSlug(admin, data.id, title, brand.company_name || '')
    if (slug) (data as { slug?: string }).slug = slug
  }
  return NextResponse.json(data, { status: 201 })
}
