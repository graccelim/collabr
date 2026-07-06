import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { aiConfigured } from '@/lib/ai/client'
import { isCreatorProActive } from '@/lib/creator-pro'
import { collaborationAnalysis } from '@/lib/ai/service'
import { checkRateLimitDurable } from '@/lib/rate-limit'

// Collaboration analysis — grounded in the campaign's own performance + the
// creator's platform insights (not "coaching"). Pro/flag/AI-gated, fail-safe.
// Cached per (creator, collab) in ai_invite_analyses.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!flags.analyticsAi) return NextResponse.json({ error: 'Not available' }, { status: 503 })
  if (!aiConfigured()) return NextResponse.json({ error: 'AI is not configured yet.' }, { status: 503 })

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
  if (!(await isCreatorProActive(admin, creator.id))) {
    return NextResponse.json({ error: 'Creator Pro required.' }, { status: 403 })
  }
  if (!(await checkRateLimitDurable(`ai-brand:${user.id}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const collabId = typeof body?.collabId === 'string' ? body.collabId : ''
  if (!collabId) return NextResponse.json({ error: 'collabId is required.' }, { status: 400 })

  // Ownership: the collab must belong to this creator.
  const { data: collab } = await admin.from('collabs')
    .select('id, creator_id, campaign_id, campaigns(title)')
    .eq('id', collabId).maybeSingle()
  if (!collab || collab.creator_id !== creator.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Ground the analysis in deterministic data: the campaign's own performance +
  // the creator's per-platform winning patterns.
  const [{ data: rollup }, { data: platformInsights }] = await Promise.all([
    collab.campaign_id ? admin.from('campaign_rollups').select('totals, derived, by_platform, top_post').eq('campaign_id', collab.campaign_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('creator_platform_insights').select('platform, data').eq('creator_id', creator.id),
  ])
  if (!rollup && !(platformInsights?.length)) {
    return NextResponse.json({ analysis: 'Not enough data yet. Once this campaign’s posts sync (and your accounts are connected), a grounded analysis appears here.' })
  }

  const campaign = (collab.campaigns as any) || {}
  try {
    const analysis = await collaborationAnalysis({
      campaign: { title: campaign.title },
      performance: rollup ?? undefined,
      platformInsights: (platformInsights ?? []).map((p) => ({ platform: p.platform, insights: (p.data as any)?.insights })),
    })
    await admin.from('ai_invite_analyses').upsert(
      { creator_id: creator.id, collab_id: collabId, model: 'claude-sonnet-4-6', analysis: { text: analysis } },
      { onConflict: 'creator_id,collab_id' },
    )
    return NextResponse.json({ analysis })
  } catch (e: any) {
    console.error('[AI brand-coach]', e?.message)
    return NextResponse.json({ error: 'Could not generate analysis.' }, { status: 502 })
  }
}
