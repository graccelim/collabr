import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { isCreatorProActive } from '@/lib/creator-pro'
import { generateStrategistForPlatform } from '@/lib/analytics/sync'
import { checkRateLimitDurable } from '@/lib/rate-limit'

// Generates ONLY the AI strategist (game plan) for one platform, on demand, from
// the already-computed deterministic insights. The Strategy tab calls this so the
// game plan loads on its own (with a loading UI) instead of being computed inline
// during connect/sync, which risked a timeout.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!flags.analyticsAi) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Same per-user cap as the sibling AI routes (brand-coach / content-lab).
  if (!(await checkRateLimitDurable(`ai-strategy:${user.id}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
  if (!(await isCreatorProActive(admin, creator.id))) {
    return NextResponse.json({ error: 'Creator Pro required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const platform = String(body?.platform || '').trim()
  if (!platform) return NextResponse.json({ error: 'platform required' }, { status: 400 })

  try {
    const strategy = await generateStrategistForPlatform(admin, creator.id as string, platform)
    return NextResponse.json({ strategy })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not generate' }, { status: 502 })
  }
}
