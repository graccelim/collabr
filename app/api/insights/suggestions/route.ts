import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { flags } from '@/lib/flags'
import { aiConfigured, AI_MODELS } from '@/lib/ai/client'
import { isCreatorProActive } from '@/lib/creator-pro'
import { growthSuggestions } from '@/lib/ai/service'
import { checkRateLimit } from '@/lib/rate-limit'

// Proactive AI Growth Suggestions (replaces the Growth Coach chat). Suite + Pro +
// AI gated. Deterministic rollup/DNA in → structured insights out. Cached in
// ai_insights by input hash so re-generation is cheap and idempotent.
function suggestionsHash(rollup: unknown, dna: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify({ rollup, dna })).digest('hex')
}

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
  if (!checkRateLimit(`ai-suggest:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const [{ data: rollup }, { data: dna }] = await Promise.all([
    supabase.from('creator_rollups').select('*').eq('creator_id', creator.id).maybeSingle(),
    supabase.from('content_dna').select('*').eq('creator_id', creator.id).maybeSingle(),
  ])
  if (!rollup && !dna) {
    return NextResponse.json({ suggestions: [], note: 'Connect accounts and let posts sync to get insights.' })
  }

  const hash = suggestionsHash(rollup, dna)
  const { data: cached } = await admin.from('ai_insights')
    .select('input_hash, suggestions').eq('creator_id', creator.id).eq('period', 'growth_suggestions').maybeSingle()
  if (cached?.input_hash === hash && Array.isArray(cached.suggestions)) {
    return NextResponse.json({ suggestions: cached.suggestions, cached: true })
  }

  try {
    const suggestions = await growthSuggestions({ contentDna: dna, rollup })
    await admin.from('ai_insights').upsert({
      creator_id: creator.id, period: 'growth_suggestions', model: AI_MODELS.batch,
      suggestions, input_hash: hash, created_at: new Date().toISOString(),
    }, { onConflict: 'creator_id,period' })
    return NextResponse.json({ suggestions })
  } catch (e: any) {
    console.error('[AI suggestions]', e?.message)
    return NextResponse.json({ error: 'Could not generate insights.' }, { status: 502 })
  }
}
