import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ensureCampaignSlug } from '@/lib/slug-server'
import { NextRequest, NextResponse } from 'next/server'
import { resolvePlan, proGateResponse, PLAN_COLUMNS } from '@/lib/plans'
import { normalizeNiche, normalizeNicheTags } from '@/lib/niches'
import { SOCIAL_PLATFORMS } from '@/lib/onboarding'

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

  // Budgets (cents): whole non-negative integers, sane cap, min ≤ max — an
  // inverted range would render "S$300 to S$150" and skew budget-fit matching.
  const asBudget = (v: unknown) => {
    if (v == null || v === '' || v === 0) return null
    const n = Number(v)
    return Number.isInteger(n) && n > 0 && n <= 100_000_000 ? n : undefined
  }
  const budgetMin = asBudget(body.budget_min)
  const budgetMax = asBudget(body.budget_max)
  if (budgetMin === undefined || budgetMax === undefined) {
    return NextResponse.json({ error: 'Budget must be a positive amount.' }, { status: 400 })
  }
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
    return NextResponse.json({ error: 'Minimum budget cannot exceed maximum budget.' }, { status: 400 })
  }
  const creatorsNeeded = Number(body.creators_needed ?? 1)
  if (!Number.isInteger(creatorsNeeded) || creatorsNeeded < 1 || creatorsNeeded > 50) {
    return NextResponse.json({ error: 'Creators needed must be between 1 and 50.' }, { status: 400 })
  }

  // Platform targeting: canonical slugs only (matches the 050 check constraint).
  // Empty = open to all platforms.
  const platforms = Array.isArray(body.platforms)
    ? Array.from(new Set(body.platforms)).filter((p): p is string =>
        (SOCIAL_PLATFORMS as readonly string[]).includes(p as string))
    : []

  const admin = createAdminClient()
  const { data, error } = await admin.from('campaigns').insert({
    brand_id: brand.id,
    title,
    brief: body.brief,
    deliverable_types: body.deliverable_types || [],
    comp_type: body.comp_type,
    budget_min: budgetMin,
    budget_max: budgetMax,
    barter_detail: body.barter_detail || null,
    // Normalize to canonical slugs so matching is reliable + the DB trigger accepts them.
    niche_tags: normalizeNicheTags(Array.isArray(body.niche_tags) ? body.niche_tags : []),
    platforms,
    min_followers: body.min_followers || 0,
    creators_needed: creatorsNeeded,
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
