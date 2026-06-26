import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { aiConfigured } from '@/lib/ai/client'
import { isCreatorProActive } from '@/lib/creator-pro'
import { brandCoachInviteAnalysis } from '@/lib/ai/service'
import { checkRateLimit } from '@/lib/rate-limit'

// AI Brand Coach — analyses a campaign invite/collab for the creator. Pro-gated,
// flag-gated, fail-safe. Cached per (creator, collab) in ai_invite_analyses.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!flags.aiGrowthCoach) return NextResponse.json({ error: 'Not available' }, { status: 503 })
  if (!aiConfigured()) return NextResponse.json({ error: 'AI is not configured yet.' }, { status: 503 })

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
  if (!(await isCreatorProActive(admin, creator.id))) {
    return NextResponse.json({ error: 'Creator Pro required.' }, { status: 403 })
  }
  if (!checkRateLimit(`ai-brand:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const collabId = typeof body?.collabId === 'string' ? body.collabId : ''
  if (!collabId) return NextResponse.json({ error: 'collabId is required.' }, { status: 400 })

  // Ownership: the collab must belong to this creator.
  const { data: collab } = await admin.from('collabs')
    .select('id, creator_id, agreed_rate, campaigns(title, brief, deliverable_types)')
    .eq('id', collabId).maybeSingle()
  if (!collab || collab.creator_id !== creator.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: dna } = await supabase.from('content_dna').select('*').eq('creator_id', creator.id).maybeSingle()
  if (!dna) {
    return NextResponse.json({ analysis: 'Not enough comparable history yet. Connect your accounts and complete a few collaborations for tailored advice.' })
  }

  const campaign = (collab.campaigns as any) || {}
  try {
    const analysis = await brandCoachInviteAnalysis({
      campaign: { title: campaign.title, brief: campaign.brief, deliverables: campaign.deliverable_types, budgetCents: collab.agreed_rate },
      contentDna: dna,
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
