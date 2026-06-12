import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { brandOnboardingSchema } from '@/lib/onboarding'

// Completes onboarding for an existing brand account: company name, industry,
// and a website or social link, then marks onboarding complete.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brand_profiles')
    .select('id, onboarding_completed_at').eq('user_id', user.id).single()
  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = brandOnboardingSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { error } = await admin.from('brand_profiles').update({
    company_name: parsed.data.company_name,
    industry: parsed.data.industry,
    website: parsed.data.website || null,
    social_url: parsed.data.social_url || null,
    onboarding_completed_at: brand.onboarding_completed_at || new Date().toISOString(),
  }).eq('id', brand.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
