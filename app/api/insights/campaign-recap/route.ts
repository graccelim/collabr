import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { flags } from '@/lib/flags'
import { aiConfigured } from '@/lib/ai/client'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'
import { campaignRecap } from '@/lib/ai/service'
import { checkRateLimit } from '@/lib/rate-limit'

// AI Campaign Recap (brand). Suite + Brand Plus + AI gated. Uses ONLY the
// deterministic campaign_rollups. Cached on campaign_rollups.ai_recap (idempotent).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!aiConfigured()) return NextResponse.json({ error: 'AI is not configured yet.' }, { status: 503 })

  const admin = createAdminClient()
  const { data: brand } = await admin.from('brand_profiles').select(`id, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
  if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
  if (!resolvePlan(brand).isPlus) return NextResponse.json({ error: 'Campaign analytics is part of Brand Plus.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const campaignId = typeof body?.campaignId === 'string' ? body.campaignId : ''
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 })
  if (!checkRateLimit(`ai-recap:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  // Ownership: the campaign must belong to this brand.
  const { data: campaign } = await admin.from('campaigns').select('id, title, brand_id').eq('id', campaignId).maybeSingle()
  if (!campaign || campaign.brand_id !== brand.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: rollup } = await admin.from('campaign_rollups').select('*').eq('campaign_id', campaignId).maybeSingle()
  if (!rollup) return NextResponse.json({ recap: 'No analytics yet for this campaign. Connect creators and let posts sync first.' })

  const metrics = { totals: rollup.totals, derived: rollup.derived, by_platform: rollup.by_platform, per_creator: rollup.per_creator, top_post: rollup.top_post, coverage: rollup.coverage }
  const hash = crypto.createHash('sha256').update(JSON.stringify(metrics)).digest('hex')
  if (rollup.ai_recap_hash === hash && (rollup.ai_recap as any)?.text) {
    return NextResponse.json({ recap: (rollup.ai_recap as any).text, cached: true })
  }

  try {
    const text = await campaignRecap({ campaign: { title: campaign.title }, metrics })
    await admin.from('campaign_rollups').update({ ai_recap: { text }, ai_recap_hash: hash }).eq('campaign_id', campaignId)
    return NextResponse.json({ recap: text })
  } catch (e: any) {
    console.error('[AI campaign-recap]', e?.message)
    return NextResponse.json({ error: 'Could not generate a recap.' }, { status: 502 })
  }
}
